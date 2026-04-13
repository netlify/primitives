import { getGoTrueClient, isBrowser } from './environment.js'
import { toUser, type User } from './user.js'

/**
 * Constants for the auth events emitted by the library.
 * Use these instead of string literals when comparing event types.
 *
 * @example
 * ```ts
 * onAuthChange((event, user) => {
 *   if (event === AUTH_EVENTS.LOGIN) console.log('Logged in:', user)
 *   if (event === AUTH_EVENTS.RECOVERY) redirect('/reset-password')
 * })
 * ```
 */
export const AUTH_EVENTS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_REFRESH: 'token_refresh',
  USER_UPDATED: 'user_updated',
  RECOVERY: 'recovery',
} as const

/**
 * Union of all auth event names: `'login' | 'logout' | 'token_refresh' | 'user_updated' | 'recovery'`.
 * Passed as the first argument to {@link AuthCallback} subscribers.
 */
export type AuthEvent = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS]

/**
 * Callback function signature for {@link onAuthChange} subscribers.
 * `user` is `null` on logout events.
 */
export type AuthCallback = (event: AuthEvent, user: User | null) => void

const GOTRUE_STORAGE_KEY = 'gotrue.user'

const listeners = new Set<AuthCallback>()

export const emitAuthEvent = (event: AuthEvent, user: User | null): void => {
  for (const listener of listeners) {
    try {
      listener(event, user)
    } catch {
      // Prevent one subscriber from breaking others
    }
  }
}

let storageListenerAttached = false

const attachStorageListener = (): void => {
  if (storageListenerAttached || !isBrowser()) return
  storageListenerAttached = true

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== GOTRUE_STORAGE_KEY) return

    if (event.newValue) {
      const client = getGoTrueClient()
      const currentUser = client?.currentUser()
      emitAuthEvent(AUTH_EVENTS.LOGIN, currentUser ? toUser(currentUser) : null)
    } else {
      emitAuthEvent(AUTH_EVENTS.LOGOUT, null)
    }
  })
}

/**
 * Subscribes to auth state changes (login, logout, token refresh, user updates,
 * and recovery). Returns an unsubscribe function. No-op on the server.
 *
 * The `'recovery'` event fires when {@link handleAuthCallback} processes a
 * password recovery token. The user is logged in but has not yet set a new
 * password. Redirect them to a password reset form and call
 * `updateUser({ password })` to complete the flow.
 */
export const onAuthChange = (callback: AuthCallback): (() => void) => {
  if (!isBrowser()) {
    return () => {}
  }

  listeners.add(callback)
  attachStorageListener()

  return () => {
    listeners.delete(callback)
  }
}
