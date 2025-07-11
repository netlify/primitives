import http from 'node:http'

import { createServerAdapter } from '@whatwg-node/server'

import { Handler } from '../lib/handler.js'

/**
 * A Node.js HTTP server with support for middleware.
 */
export class HTTPServer {
  private url?: string
  private handler: Handler
  private nodeServer?: http.Server

  constructor(handler: Handler) {
    this.handler = handler
  }

  async start(port = 0) {
    if (this.url) {
      return this.url
    }

    const adapter = createServerAdapter((request: Request) => this.handler(request))
    const server = http.createServer(adapter)

    this.nodeServer = server

    return new Promise<string>((resolve, reject) => {
      server.listen(port, () => {
        const address = server.address()

        if (!address || typeof address === 'string') {
          return reject(new Error('Server cannot be started on a pipe or Unix socket'))
        }

        const url = `http://localhost:${address.port}`
        this.url = url

        resolve(url)
      })
    })
  }

  async stop() {
    const server = this.nodeServer

    if (!server) {
      return
    }

    await new Promise((resolve, reject) => {
      server.close((error?: NodeJS.ErrnoException) => {
        if (error) {
          return reject(error)
        }

        resolve(null)
      })
    })
  }
}
