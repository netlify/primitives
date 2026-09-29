import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocketServer, type WebSocket as WsWebSocket } from 'ws'

import { WebSocket } from './websocket.js'

// Shared with the platform: it attaches the raw upgrade primitives to the
// request under the first key, and looks for the second on the response to
// know the socket has been taken over.
const requestNodePrimitivesSymbol = Symbol.for('$netlify.requestNodePrimitives')
const responseUpgradedSymbol = Symbol.for('$netlify.responseUpgraded')

interface NodePrimitives {
  request: IncomingMessage
  socket: Duplex
  head: Buffer
}

export interface UpgradeWebSocketOptions {
  /**
   * Sets the `protocol` property of the client's WebSocket. Should match one
   * of the protocols the client asked for.
   */
  protocol?: string

  /**
   * Seconds to wait for a pong after each ping before closing the connection.
   * Pings are only sent when this is above 0.
   */
  idleTimeout?: number
}

export interface WebSocketUpgrade {
  /**
   * The server side of the connection, a browser-style `WebSocket`.
   */
  socket: WebSocket

  /**
   * The response to return from the handler to complete the upgrade.
   */
  response: Response
}

const keepAlive = (ws: WsWebSocket, idleTimeoutSeconds: number) => {
  let isAlive = true

  const pingTimer = setInterval(() => {
    if (!isAlive) {
      ws.terminate()

      return
    }

    isAlive = false
    ws.ping()
  }, idleTimeoutSeconds * 1000)

  ws.on('pong', () => {
    isAlive = true
  })

  ws.on('close', () => {
    clearInterval(pingTimer)
  })
}

/**
 * Upgrades a request to a WebSocket connection. Return the `response` from the
 * handler and use the `socket` to talk to the client.
 */
export const upgradeWebSocket = (request: Request, options: UpgradeWebSocketOptions = {}): WebSocketUpgrade => {
  const primitives = (request as Request & Record<symbol, NodePrimitives | undefined>)[requestNodePrimitivesSymbol]

  if (!primitives) {
    throw new Error('upgradeWebSocket() can only upgrade a request received by a Netlify Server.')
  }

  const { protocol } = options
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: protocol === undefined ? undefined : () => protocol,
  })

  let ws: WsWebSocket | undefined

  // Without a `verifyClient` option, `handleUpgrade` completes synchronously.
  wss.handleUpgrade(primitives.request, primitives.socket, primitives.head, (socket) => {
    ws = socket
  })

  if (!ws) {
    throw new Error('WebSocket upgrade failed.')
  }

  if (options.idleTimeout !== undefined && options.idleTimeout > 0) {
    keepAlive(ws, options.idleTimeout)
  }

  const response = new Response(null)

  Object.defineProperty(response, responseUpgradedSymbol, { value: true })

  return { socket: new WebSocket(ws), response }
}
