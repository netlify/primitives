import { mkdir } from 'node:fs/promises'
import { createServer as createNetServer, type AddressInfo, type Server, type Socket } from 'node:net'

import { PGlite } from '@electric-sql/pglite'
import type { ConnectionState, MessageResponse } from 'pg-gateway'
import { fromNodeSocket } from 'pg-gateway/node'

import { broadcastNotifications } from './lib/notifications.js'

const DEFAULT_HOST = 'localhost'

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

export class NetlifyDB {
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
