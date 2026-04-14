import net from 'node:net'

import { handleConnection } from './lib/connection.js'

export interface ConnectionCredentials {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl?: boolean | object
  options?: string
}

export type ProvisionCallback = () => Promise<string>

export interface NetlifyDBProxyOptions {
  host?: string
  port?: number
  logger?: (...args: unknown[]) => void
  provision: ProvisionCallback
}

export function parseConnectionString(connectionString: string): ConnectionCredentials {
  const url = new URL(connectionString)

  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: url.searchParams.get('sslmode') === 'require' ? true : undefined,
    options: url.searchParams.get('options') ?? undefined,
  }
}

export class NetlifyDBProxy {
  private server: net.Server | undefined
  private sockets = new Set<net.Socket>()
  private host: string
  private port: number
  private logger: (...args: unknown[]) => void
  private provision: ProvisionCallback

  constructor(options: NetlifyDBProxyOptions) {
    this.host = options.host ?? '127.0.0.1'
    this.port = options.port ?? 0
    this.logger = options.logger ?? (() => {})
    this.provision = options.provision
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        this.sockets.add(socket)
        socket.on('close', () => {
          this.sockets.delete(socket)
        })

        handleConnection(socket, {
          provision: this.provision,
          logger: this.logger,
          onCleanup: () => {
            this.sockets.delete(socket)
          },
        })
      })

      server.on('error', (err) => {
        reject(err)
      })

      server.listen(this.port, this.host, () => {
        this.server = server
        const addr = server.address() as net.AddressInfo
        const connectionString = `postgres://${this.host}:${String(addr.port)}`
        this.logger('Proxy listening on', connectionString)
        resolve(connectionString)
      })
    })
  }

  async stop(): Promise<void> {
    // Destroy all active client sockets
    for (const socket of this.sockets) {
      socket.destroy()
    }
    this.sockets.clear()

    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }

      this.server.close(() => {
        this.server = undefined
        resolve()
      })
    })
  }
}
