import { existsSync } from 'node:fs'
import { mkdir, readFile, rename } from 'node:fs/promises'
import { createServer as createNetServer, type AddressInfo, type Server, type Socket } from 'node:net'
import { join, resolve } from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { ConnectionState, MessageResponse } from 'pg-gateway'
import { fromNodeSocket } from 'pg-gateway/node'

import { broadcastNotifications } from './lib/notifications.js'
import { applyMigrations, initializeTrackingTable } from './lib/migrations.js'
import type { SQLExecutor } from './lib/sql-executor.js'

export { applyMigrations, initializeTrackingTable } from './lib/migrations.js'
export type { SQLExecutor } from './lib/sql-executor.js'

const DEFAULT_HOST = 'localhost'

// pg-gateway rejects any startup message without a `user`, and `pg` only falls
// back to `process.env.USER`, which Edge Functions isolates don't expose. The
// server authenticates with `trust`, so the value is arbitrary.
const DEFAULT_USER = 'postgres'

type Logger = (...message: unknown[]) => void

export interface NetlifyDBOptions {
  /**
   * Directory for data persistence. If not provided, uses in-memory storage.
   */
  directory?: string

  /**
   * Function to log messages. Defaults to `console.log`.
   */
  logger?: Logger

  /**
   * Port to run the database server on. If not provided, picks a random available port.
   */
  port?: number
}

// Postgres records the major version that created a data directory in this
// file at its root.
async function readDataDirectoryVersion(directory: string): Promise<string | undefined> {
  const version = await readFile(join(directory, 'PG_VERSION'), 'utf8').catch(() => undefined)

  return version?.trim().match(/^\d+$/)?.[0]
}

// PGlite doesn't expose the Postgres version it bundles, so it's read from a
// throwaway in-memory instance.
async function readBundledVersion(): Promise<{ major: string; version: string }> {
  const db = await PGlite.create()

  try {
    const { rows } = await db.query<{ major: string; version: string }>(
      `SELECT current_setting('server_version') AS version,
              (current_setting('server_version_num')::int / 10000)::text AS major`,
    )

    return rows[0]
  } finally {
    await db.close()
  }
}

function getBackupPath(directory: string, version: string): string {
  const backupPath = `${resolve(directory)}.pg${version}`

  if (!existsSync(backupPath)) {
    return backupPath
  }

  return `${backupPath}-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`
}

export async function resetDatabase(db: SQLExecutor): Promise<void> {
  const result = await db.query<{ schema_name: string }>(
    `SELECT schema_name
     FROM information_schema.schemata
     WHERE schema_name <> 'information_schema'
       AND schema_name NOT LIKE 'pg_%'`,
  )

  for (const { schema_name } of result.rows) {
    const escapedSchemaName = schema_name.replaceAll('"', '""')
    await db.exec(`DROP SCHEMA "${escapedSchemaName}" CASCADE`)
  }

  await db.exec('CREATE SCHEMA IF NOT EXISTS public')
  await initializeTrackingTable(db)
}

export class NetlifyDB implements SQLExecutor {
  private db?: PGlite
  private directory?: string
  private logger: Logger
  private port?: number
  private server?: Server

  // All active client sockets, tracked so notifications can be broadcast
  // and so they can be destroyed on stop().
  private connections = new Set<Socket>()

  // Unsubscribe function for the global onNotification handler.
  private unsubNotification?: () => void

  constructor({ directory, logger, port }: NetlifyDBOptions = {}) {
    this.directory = directory
    this.logger = logger ?? console.log
    this.port = port
  }

  async start(): Promise<string> {
    this.db = this.directory ? await this.openDirectory(this.directory) : await PGlite.create()

    await initializeTrackingTable(this.db)

    this.unsubNotification = broadcastNotifications(this.db, this.connections)

    this.server = createNetServer((socket: Socket) => {
      this.handleConnection(socket)
    })

    return new Promise<string>((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'))

        return
      }

      this.server.on('error', reject)
      this.server.listen(this.port ?? 0, DEFAULT_HOST, () => {
        this.server?.off('error', reject)

        const { address, port } = this.server?.address() as AddressInfo
        const host = address === '::1' || address === '127.0.0.1' ? 'localhost' : address

        resolve(`postgres://${DEFAULT_USER}@${host}:${String(port)}/postgres`)
      })
    })
  }

  async applyMigrations(migrationsDirectory: string, target?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database has not been started. Call start() before applying migrations.')
    }

    return applyMigrations(this.db, migrationsDirectory, target)
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database has not been started. Call start() before resetting.')
    }

    await resetDatabase(this.db)
  }

  async exec(sql: string): Promise<unknown> {
    if (!this.db) {
      throw new Error('Database has not been started. Call start() before executing queries.')
    }

    return this.db.exec(sql)
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    if (!this.db) {
      throw new Error('Database has not been started. Call start() before executing queries.')
    }

    return this.db.query<T>(sql, params)
  }

  async transaction<T>(fn: (tx: Pick<SQLExecutor, 'exec' | 'query'>) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Database has not been started. Call start() before executing queries.')
    }

    return this.db.transaction(fn)
  }

  async stop(): Promise<void> {
    if (this.unsubNotification) {
      this.unsubNotification()
      this.unsubNotification = undefined
    }

    // Destroy all active client connections so the server can close
    // immediately rather than waiting for long-lived connections (e.g.
    // LISTEN) to end on their own.
    for (const socket of this.connections) {
      socket.destroy()
    }

    this.connections.clear()

    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve()

        return
      }

      this.server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // Close PGLite to release internal handles (WASM runtime, etc.).
    if (this.db) {
      await this.db.close()
      this.db = undefined
    }
  }

  // A data directory created by a different Postgres major version can't be
  // opened, so it's moved aside (never deleted) and a fresh database takes its
  // place. Any other failure to open the directory is left to the caller.
  private async openDirectory(directory: string): Promise<PGlite> {
    await mkdir(directory, { recursive: true })

    const previousVersion = await readDataDirectoryVersion(directory)

    let bundled: { major: string; version: string }

    try {
      return await PGlite.create(directory)
    } catch (error) {
      if (previousVersion === undefined) {
        throw error
      }

      bundled = await readBundledVersion()

      if (bundled.major === previousVersion) {
        throw error
      }
    }

    const backupPath = getBackupPath(directory, previousVersion)

    await rename(directory, backupPath)
    await mkdir(directory)

    this.logger(
      `The local database was created by PostgreSQL ${previousVersion}, but this version of the dev server bundles PostgreSQL ${bundled.version}. The old data was moved to ${backupPath} and a new, empty database was created. Apply your migrations again to recreate the schema.`,
    )

    return PGlite.create(directory)
  }

  private handleConnection(socket: Socket): void {
    if (!this.db) {
      return
    }

    const db = this.db

    this.connections.add(socket)

    socket.on('close', () => {
      this.connections.delete(socket)
    })

    fromNodeSocket(socket, {
      serverVersion: '16.3 (NetlifyDB/pglite)',
      auth: {
        method: 'trust',
      },

      async onMessage(data: Uint8Array, { isAuthenticated }: ConnectionState): Promise<MessageResponse> {
        // Skip startup/handshake messages handled by pg-gateway, as PGLite
        // doesn't expect them.
        if (!isAuthenticated) {
          return
        }

        return db.execProtocolRaw(data)
      },
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('ECONNRESET')) {
        return
      }

      this.logger('Unexpected connection error:', error)
    })
  }
}
