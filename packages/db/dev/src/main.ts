import { readdir, readFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer as createNetServer, type AddressInfo, type Server, type Socket } from 'node:net'

import type { Dirent } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'
import type { ConnectionState, MessageResponse } from 'pg-gateway'
import { fromNodeSocket } from 'pg-gateway/node'

import { broadcastNotifications } from './lib/notifications.js'
import { applyMigrations } from './lib/migrations.js'

import { Client } from 'pg'

const DEFAULT_HOST = 'localhost'

const MIGRATION_DIR_PATTERN = /^\d+_.+$/
const MIGRATION_FILE = 'migration.sql'
const TRACKING_TABLE = 'netlify_migrations'

type Logger = (...message: unknown[]) => void

export interface NetlifyDBOptions {
  /**
   * Connection string to an already-running database. When provided, NetlifyDB
   * connects to the existing instance instead of starting a new PGlite server.
   */
  connectionString?: string

  /**
   * Directory for data persistence. If not provided, uses in-memory storage.
   * Ignored when `connectionString` is set.
   */
  directory?: string

  /**
   * Function to log messages. Defaults to `console.log`.
   */
  logger?: Logger

  /**
   * Port to run the database server on. If not provided, picks a random available port.
   * Ignored when `connectionString` is set.
   */
  port?: number
}

export class NetlifyDB {
  private connectionString?: string
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

  constructor({ connectionString, directory, logger, port }: NetlifyDBOptions = {}) {
    this.connectionString = connectionString
    this.directory = directory
    this.logger = logger ?? console.log
    this.port = port
  }

  async start(): Promise<string> {
    if (this.connectionString) {
      return this.connectionString
    }

    if (this.directory) {
      await mkdir(this.directory, { recursive: true })
    }

    this.db = await PGlite.create(this.directory)

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

        resolve(`postgres://${host}:${String(port)}/postgres`)
      })
    })
  }

  async applyMigrations(migrationsDirectory: string, target?: string): Promise<string[]> {
    if (this.db) {
      return applyMigrations(this.db, migrationsDirectory, target)
    }

    if (this.connectionString) {
      return this.withPgClient((pgClient) => this.applyMigrationsViaClient(pgClient, migrationsDirectory, target))
    }

    throw new Error('Database has not been started. Call start() before applying migrations.')
  }

  private async applyMigrationsViaClient(pgClient: Client, migrationsDirectory: string, target?: string): Promise<string[]> {
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    let entries: string[]

    try {
      const dirents = await readdir(migrationsDirectory, { withFileTypes: true })
      entries = dirents
        .filter((entry: Dirent) => entry.isDirectory() && MIGRATION_DIR_PATTERN.test(entry.name))
        .map((d) => d.name)
    } catch {
      throw new Error(`Migration directory not found: ${migrationsDirectory}`)
    }

    entries.sort()

    let migrationsToConsider: string[]

    if (target === undefined) {
      migrationsToConsider = entries
    } else {
      let targetIndex = entries.indexOf(target)

      if (targetIndex === -1) {
        targetIndex = entries.findIndex((name) => name.startsWith(`${target}_`))
      }

      if (targetIndex === -1) {
        throw new Error(`No migration found matching target: ${target}`)
      }

      migrationsToConsider = entries.slice(0, targetIndex + 1)
    }

    const result = await pgClient.query<{ name: string }>(`SELECT name FROM ${TRACKING_TABLE} WHERE name = ANY($1)`, [
      migrationsToConsider,
    ])
    const alreadyApplied = new Set(result.rows.map((row) => row.name))

    const applied: string[] = []

    for (const name of migrationsToConsider) {
      if (alreadyApplied.has(name)) {
        continue
      }

      const sqlPath = join(migrationsDirectory, name, MIGRATION_FILE)
      let sql: string

      try {
        sql = await readFile(sqlPath, 'utf-8')
      } catch {
        throw new Error(`${MIGRATION_FILE} not found in migration directory: ${name}`)
      }

      await pgClient.query('BEGIN')
      try {
        await pgClient.query(sql)
        await pgClient.query(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [name])
        await pgClient.query('COMMIT')
      } catch (error) {
        await pgClient.query('ROLLBACK')
        throw error
      }

      applied.push(name)
    }

    return applied
  }

  async reset(): Promise<void> {
    if (this.db) {
      return this.resetDb(this.db)
    }

    if (this.connectionString) {
      return this.withPgClient((pgClient) => this.resetViaClient(pgClient))
    }

    throw new Error('Database has not been started. Call start() before resetting.')
  }

  private async resetDb(db: PGlite): Promise<void> {
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
  }

  private async resetViaClient(pgClient: Client): Promise<void> {
    const result = await pgClient.query<{ schema_name: string }>(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name <> 'information_schema'
         AND schema_name NOT LIKE 'pg_%'`,
    )

    for (const { schema_name } of result.rows) {
      const escapedSchemaName = schema_name.replaceAll('"', '""')
      await pgClient.query(`DROP SCHEMA "${escapedSchemaName}" CASCADE`)
    }

    await pgClient.query('CREATE SCHEMA IF NOT EXISTS public')
  }

  private async withPgClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const pgClient = new Client({ connectionString: this.connectionString })
    await pgClient.connect()
    try {
      return await fn(pgClient)
    } finally {
      await pgClient.end()
    }
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
