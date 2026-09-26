import type { Socket } from 'node:net'

import type { PGlite } from '@electric-sql/pglite'

import type { Backend } from './backend.js'
import {
  FrontendMessage,
  PROTOCOL_VERSION_3_0,
  ProtocolError,
  buildAuthenticationOk,
  buildBackendKeyData,
  buildErrorResponse,
  buildParameterStatus,
  buildReadyForQuery,
  concatBytes,
  readStartupPacket,
  rewriteStatementName,
  splitMessages,
} from './protocol.js'

// Settings a real server reports through ParameterStatus after authentication.
// Clients rely on some of them (e.g. `server_version`, `integer_datetimes`).
const REPORTED_PARAMETERS = [
  'server_version',
  'server_encoding',
  'client_encoding',
  'application_name',
  'is_superuser',
  'session_authorization',
  'DateStyle',
  'IntervalStyle',
  'TimeZone',
  'integer_datetimes',
  'standard_conforming_strings',
  'default_transaction_read_only',
  'in_hot_standby',
  'scram_iterations',
]

// Settings PGlite doesn't expose through `pg_settings` are left out.
export async function readServerParameters(db: PGlite): Promise<Map<string, string>> {
  const { rows } = await db.query<{ name: string; setting: string }>(
    'SELECT name, setting FROM pg_settings WHERE name = ANY($1)',
    [REPORTED_PARAMETERS],
  )

  return new Map(rows.map(({ name, setting }) => [name, setting]))
}

export interface ConnectionOptions {
  backend: Backend

  /**
   * Unique per connection. Reported as the backend process id and used to
   * namespace the connection's prepared statements.
   */
  processId: number

  /**
   * Reported to the client through ParameterStatus during the handshake.
   */
  serverParameters: ReadonlyMap<string, string>

  onError: (error: unknown) => void
}

// Emulates the startup handshake, then frames the client's messages and hands
// them to the shared backend.
export function serveConnection(
  socket: Socket,
  { backend, onError, processId, serverParameters }: ConnectionOptions,
): void {
  // Prepared statements live in the single backend session, so two clients
  // preparing the same name would collide. The prefix is short because
  // Postgres keys statements on the first 63 bytes of the name.
  const statementPrefix = `${String(processId)}_`
  const statements = new Set<string>()

  let phase: 'startup' | 'ready' | 'closed' = 'startup'
  let buffer: Uint8Array = new Uint8Array(0)

  // Responses are written per message, so Nagle's algorithm would hold each
  // one back until the client acknowledges the previous one. Postgres sets
  // TCP_NODELAY on its sockets too.
  socket.setNoDelay(true)

  const write = (bytes: Uint8Array) => {
    if (socket.writable) {
      socket.write(bytes)
    }
  }

  const close = () => {
    phase = 'closed'
    socket.end()
  }

  const session = backend.openSession({
    onResponse: write,
    onError(error) {
      onError(error)
      socket.destroy()
    },
  })

  const readStartup = () => {
    while (phase === 'startup') {
      const result = readStartupPacket(buffer)

      if (!result) {
        return
      }

      buffer = buffer.subarray(result.length)

      const { packet } = result

      switch (packet.kind) {
        // `N` tells the client to continue unencrypted on the same socket.
        case 'ssl-request':
        case 'gssenc-request':
          write(new Uint8Array([0x4e])) // 'N'

          break

        // Queries cannot be cancelled on the single backend.
        case 'cancel-request':
          close()

          break

        case 'startup':
          if (packet.protocolVersion !== PROTOCOL_VERSION_3_0) {
            throw new ProtocolError(
              `Unsupported frontend protocol ${String(packet.protocolVersion >> 16)}.${String(packet.protocolVersion & 0xffff)}: the server supports 3.0.`,
            )
          }

          // The startup parameters (user, database, options) are not validated:
          // the server trusts every client and has one database.
          write(
            concatBytes(
              buildAuthenticationOk(),
              ...Array.from(serverParameters, ([name, value]) => buildParameterStatus(name, value)),
              buildBackendKeyData(processId, 0),
              buildReadyForQuery('I'),
            ),
          )
          phase = 'ready'

          break
      }
    }
  }

  const readMessages = () => {
    const { messages, rest } = splitMessages(buffer)
    const forwarded: Uint8Array[] = []

    buffer = rest

    for (const message of messages) {
      // PGlite keeps its session alive on Terminate, so it is not forwarded.
      if (message[0] === FrontendMessage.Terminate) {
        close()

        break
      }

      const rewritten = rewriteStatementName(message, { prefix: statementPrefix })

      if (rewritten.name !== undefined) {
        if (message[0] === FrontendMessage.Parse) {
          statements.add(rewritten.name)
        } else if (message[0] === FrontendMessage.Close) {
          statements.delete(rewritten.name)
        }
      }

      forwarded.push(rewritten.message)
    }

    session.send(forwarded)
  }

  socket.on('data', (chunk: Buffer) => {
    if (phase === 'closed') {
      return
    }

    buffer = buffer.length === 0 ? chunk : concatBytes(buffer, chunk)

    try {
      readStartup()

      if (phase === 'ready') {
        readMessages()
      }
    } catch (error) {
      if (error instanceof ProtocolError) {
        write(buildErrorResponse({ code: error.code, message: error.message, severity: 'FATAL' }))
        close()
      } else {
        onError(error)
        socket.destroy()
      }
    }
  })

  socket.on('error', onError)

  socket.on('close', () => {
    phase = 'closed'
    session.release(statements)
  })
}
