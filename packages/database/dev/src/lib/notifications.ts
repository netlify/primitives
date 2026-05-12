import type { Socket } from 'node:net'

import type { PGlite } from '@electric-sql/pglite'

// PostgreSQL wire protocol message type for NotificationResponse.
// https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-NOTIFICATIONRESPONSE
const NOTIFICATION_RESPONSE = 0x41 // 'A'

const textEncoder = new TextEncoder()

/**
 * Encodes a NotificationResponse message according to the PostgreSQL wire
 * protocol. The format is:
 *
 *   Byte1('A') | Int32(length) | Int32(processId) | String(channel) | String(payload)
 *
 * Where strings are null-terminated and `length` includes itself but not the
 * message type byte.
 *
 * https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-NOTIFICATIONRESPONSE
 */
function buildNotificationResponse(channel: string, payload: string, processId = 0): Uint8Array {
  const channelBytes = textEncoder.encode(channel)
  const payloadBytes = textEncoder.encode(payload)

  // 4 bytes for Int32(length) + 4 bytes for Int32(processId) + 1 null terminator per string
  const bodyLength = 10 + channelBytes.length + payloadBytes.length
  const buf = new Uint8Array(1 + bodyLength)
  const view = new DataView(buf.buffer)
  let offset = 0

  buf[offset++] = NOTIFICATION_RESPONSE
  view.setInt32(offset, bodyLength)
  offset += 4
  view.setInt32(offset, processId)
  offset += 4
  buf.set(channelBytes, offset)
  offset += channelBytes.length
  buf[offset++] = 0
  buf.set(payloadBytes, offset)
  offset += payloadBytes.length
  buf[offset++] = 0

  return buf
}

/**
 * Subscribes to PGLite's `onNotification` callback and broadcasts each
 * notification to every connected socket as a wire-protocol
 * NotificationResponse message.
 *
 * This is necessary because PGLite exposes a single internal connection.
 * When multiple clients connect through pg-gateway, a NOTIFY triggered by
 * one client produces a NotificationResponse in that client's
 * `execProtocolRaw` response — not on the socket of the client that called
 * LISTEN. By hooking into `onNotification` (https://pglite.dev/docs/api#onnotification)
 * and writing directly to every socket, we ensure listeners receive
 * notifications regardless of which connection triggered the NOTIFY.
 *
 * Returns an unsubscribe function that stops the broadcast.
 */
export function broadcastNotifications(db: PGlite, connections: Set<Socket>): () => void {
  return db.onNotification((channel, payload) => {
    const message = buildNotificationResponse(channel, payload)

    for (const socket of connections) {
      if (!socket.destroyed) {
        socket.write(message)
      }
    }
  })
}
