import { mkdir } from 'node:fs/promises'
import { createServer as createNetServer, type AddressInfo, type Server, type Socket } from 'node:net'

import { PGlite } from '@electric-sql/pglite'
import type { ConnectionState, MessageResponse } from 'pg-gateway'
import { fromNodeSocket } from 'pg-gateway/node'

const DEFAULT_HOST = 'localhost'

export interface NetlifyDBOptions {
  /**
   * Directory for data persistence. If not provided, uses in-memory storage.
   */
  directory?: string

  /**
   * Port to run the database server on. If not provided, picks a random available port.
   */
  port?: number
}

export class NetlifyDB {
  private db?: PGlite
  private directory?: string
  private port?: number
  private server?: Server

  constructor({ directory, port }: NetlifyDBOptions = {}) {
    this.directory = directory
    this.port = port
  }

  async start(): Promise<string> {
    if (this.directory) {
      await mkdir(this.directory, { recursive: true })
    }

    this.db = await PGlite.create(this.directory)

    this.server = createNetServer((socket: Socket) => {
      void this.handleConnection(socket)
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
    return new Promise<void>((resolve, reject) => {
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
  }

  private async handleConnection(socket: Socket): Promise<void> {
    if (!this.db) {
      return
    }

    const db = this.db

    try {
      await fromNodeSocket(socket, {
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
      })
    } catch {
      // Connection errors are expected when clients disconnect
    }
  }
}
