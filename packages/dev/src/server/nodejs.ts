import http from "node:http"

import { Server } from "./adapter.js"

export class NodeServer extends Server {
  nodeServer?: http.Server

  async start(port = 0) {
    const adapter = this.getServerAdapter()
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
    if (!this.nodeServer) {
      return
    }

    await new Promise((resolve, reject) => {
      this.nodeServer?.close((error?: NodeJS.ErrnoException) => {
        if (error) {
          return reject(error)
        }

        resolve(null)
      })
    })
  }
}