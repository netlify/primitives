import type { Socket } from 'node:net'

import type { PGlite } from '@electric-sql/pglite'

import { buildNotificationResponse } from './protocol.js'

/**
 * Subscribes to PGLite's `onNotification` callback and broadcasts each
 * notification to every connected socket as a wire-protocol
 * NotificationResponse message.
 *
 * This is necessary because PGLite exposes a single internal connection.
 * When multiple clients connect through the TCP proxy, a NOTIFY triggered by
 * one client produces a NotificationResponse in that client's
 * `execProtocolRaw` response — not on the socket of the client that called
 * LISTEN. By hooking into `onNotification` (https://pglite.dev/docs/api#onnotification)
 * and writing directly to every socket, we ensure listeners receive
 * notifications regardless of which connection triggered the NOTIFY. The
 * proxy strips the NotificationResponse messages from `execProtocolRaw`
 * responses so that each notification is delivered exactly once.
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
