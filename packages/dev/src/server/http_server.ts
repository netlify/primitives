import http from "node:http"

import { createServerAdapter } from '@whatwg-node/server'

import { Server } from "./server.js"

/**
 * A Node.js HTTP server with support for middleware.
 */
export class HTTPServer extends Server {
  nodeServer?: http.Server

  async start(port = 0) {
    const adapter = createServerAdapter((request: Request) => this.handleRequest(request))
    const server = http.createServer(adapter)

    this.nodeServer = server
    
    return new Promise<string>((resolve, reject) => {
      server.listen(port, () => {
        const address = server.address()

        if (!address || typeof address === 'string') {
          return reject(new Error('Server cannot be started on a pipe or Unix socket'))
        }

        resolve(`http://localhost:${address.port}`)
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