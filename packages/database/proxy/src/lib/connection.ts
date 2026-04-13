import net from 'node:net'

import pg from 'pg'

import type { ProvisionCallback } from '../main.js'
import { parseConnectionString } from '../main.js'

import {
  SSL_REQUEST_CODE,
  PROTOCOL_VERSION_3_0,
  SSL_RESPONSE_NO,
  buildAuthOkAndReady,
  buildErrorResponse,
} from './pg-protocol.js'

interface HandleStartupOptions {
  clientSocket: net.Socket
  provision: ProvisionCallback
  logger: (...args: unknown[]) => void
  cleanup: () => void
}

async function handleStartup(options: HandleStartupOptions): Promise<net.Socket> {
  const { clientSocket, provision, logger, cleanup } = options

  let connectionString: string
  try {
    connectionString = await provision()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    logger('Provisioning error:', message)
    clientSocket.end(buildErrorResponse(message))
    cleanup()
    throw err
  }

  const credentials = parseConnectionString(connectionString)

  const pgClient = new pg.Client({
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    ssl: credentials.ssl,
    options: credentials.options,
  })

  // Suppress unhandled errors from the pg client
  pgClient.on('error', () => {})

  try {
    await pgClient.connect()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Remote connection failed'
    logger('Remote connection error:', message)
    clientSocket.end(buildErrorResponse(message))
    cleanup()
    throw err
  }

  // Get the underlying socket from the pg client.
  const pgConnection = pgClient.connection
  const pgStream = pgConnection.stream as net.Socket

  // Completely mute the pg driver — remove all listeners from both
  // the Connection EventEmitter and the raw socket so we can handle
  // raw bytes ourselves without the driver interfering or throwing
  // unhandled errors on teardown.
  pgConnection.removeAllListeners()
  pgStream.removeAllListeners()

  const remoteSocket = pgStream

  // Set up error/close handlers on both sides
  const onError = (side: string) => (err: NodeJS.ErrnoException) => {
    if (err.code !== 'ECONNRESET') {
      logger(`${side} socket error:`, err.message)
    }
    cleanup()
  }

  remoteSocket.on('error', onError('Remote'))
  remoteSocket.on('close', cleanup)
  clientSocket.on('error', onError('Client'))
  clientSocket.on('close', cleanup)

  // Send auth OK and ready to the client
  clientSocket.write(buildAuthOkAndReady())

  // Set up bidirectional data forwarding (manual instead of pipe
  // to avoid pipe adding its own end/close/error listeners that
  // can cause unhandled errors during teardown)
  clientSocket.on('data', (chunk: Buffer) => {
    if (!remoteSocket.destroyed) {
      remoteSocket.write(chunk)
    }
  })

  remoteSocket.on('data', (chunk: Buffer) => {
    if (!clientSocket.destroyed) {
      clientSocket.write(chunk)
    }
  })

  clientSocket.resume()

  return remoteSocket
}

interface ConnectionHandlerOptions {
  provision: ProvisionCallback
  logger: (...args: unknown[]) => void
  onCleanup: () => void
}

export function handleConnection(clientSocket: net.Socket, options: ConnectionHandlerOptions): void {
  const { provision, logger, onCleanup } = options
  let remoteSocket: net.Socket | undefined
  let phase: 'ssl' | 'startup' | 'piping' = 'ssl'
  let cleaned = false

  function cleanup() {
    if (cleaned) return
    cleaned = true

    clientSocket.destroy()
    remoteSocket?.destroy()
    onCleanup()
  }

  clientSocket.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'ECONNRESET') {
      logger('Client socket error:', err.message)
    }
    cleanup()
  })

  clientSocket.on('data', (data: Buffer) => {
    if (phase === 'ssl') {
      if (data.length >= 8) {
        const requestCode = data.readInt32BE(4)
        if (requestCode === SSL_REQUEST_CODE) {
          clientSocket.write(SSL_RESPONSE_NO)
          phase = 'startup'
          return
        }
      }
      phase = 'startup'
    }

    if (phase === 'startup') {
      if (data.length < 8) {
        clientSocket.end(buildErrorResponse('Invalid startup message'))
        cleanup()
        return
      }

      const protocolVersion = data.readInt32BE(4)
      if (protocolVersion !== PROTOCOL_VERSION_3_0) {
        clientSocket.end(buildErrorResponse('Unsupported protocol version'))
        cleanup()
        return
      }

      clientSocket.pause()
      clientSocket.removeAllListeners('data')

      handleStartup({ clientSocket, provision, logger, cleanup }).then(
        (stream) => {
          remoteSocket = stream
        },
        (err: unknown) => {
          logger('Startup error:', err)
          cleanup()
        },
      )
    }
  })
}
