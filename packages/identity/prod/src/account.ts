import type { UserData, User as GoTrueUser } from 'gotrue-js'

import type { UserUpdates, GoTrueErrorBody } from './types.js'
import type { User } from './user.js'
import { toUser } from './user.js'
import { getClient, isBrowser, IDENTITY_PATH } from './environment.js'
import { persistSession, hydrateSession } from './auth.js'
import { AUTH_EVENTS, emitAuthEvent } from './events.js'
import { AuthError } from './errors.js'
import { startTokenRefresh } from './refresh.js'

/**
 * Returns the current Identity user, attempting hydration from cookies if
 * no in-memory session exists. Throws if no user can be resolved.
 */
const resolveCurrentUser = async (): Promise<GoTrueUser> => {
  const client = getClient()

  let currentUser = client.currentUser()
  if (!currentUser && isBrowser()) {
    try {
      await hydrateSession()
    } catch {
      // hydration failed (e.g. expired cookie, network error) — fall through
    }
    currentUser = client.currentUser()
  }
  if (!currentUser) throw new AuthError('No user is currently logged in')

  return currentUser
}

/**
 * Sends a password recovery email to the given address.
 *
 * @throws {AuthError} On network failure or if the request is rejected.
 */
export const requestPasswordRecovery = async (email: string): Promise<void> => {
  const client = getClient()

  try {
    await client.requestPasswordRecovery(email)
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Redeems a recovery token and sets a new password. Logs the user in on success.
 *
 * @throws {AuthError} If the token is invalid, expired, or the update fails.
 */
export const recoverPassword = async (token: string, newPassword: string): Promise<User> => {
  const client = getClient()

  try {
    const gotrueUser = await client.recover(token, persistSession)
    const updatedUser = await gotrueUser.update({ password: newPassword })
    const user = toUser(updatedUser)
    startTokenRefresh()
    // Emits LOGIN because the recovery is fully complete
    emitAuthEvent(AUTH_EVENTS.LOGIN, user)
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Confirms an email address using the token from a confirmation email. Logs the user in on success.
 *
 * @throws {AuthError} If the token is invalid or expired.
 */
export const confirmEmail = async (token: string): Promise<User> => {
  const client = getClient()

  try {
    const gotrueUser = await client.confirm(token, persistSession)
    const user = toUser(gotrueUser)
    startTokenRefresh()
    emitAuthEvent(AUTH_EVENTS.LOGIN, user)
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Accepts an invite token and sets a password for the new account. Logs the user in on success.
 *
 * @throws {AuthError} If the token is invalid or expired.
 */
export const acceptInvite = async (token: string, password: string): Promise<User> => {
  const client = getClient()

  try {
    const gotrueUser = await client.acceptInvite(token, password, persistSession)
    const user = toUser(gotrueUser)
    startTokenRefresh()
    emitAuthEvent(AUTH_EVENTS.LOGIN, user)
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Verifies an email change using the token from a verification email.
 * Auto-hydrates from auth cookies if no browser session exists. Browser only.
 *
 * @throws {AuthError} If called on the server, no user is logged in, or the token is invalid.
 */
export const verifyEmailChange = async (token: string): Promise<User> => {
  if (!isBrowser()) throw new AuthError('verifyEmailChange() is only available in the browser')

  const currentUser = await resolveCurrentUser()

  try {
    const jwt = (await currentUser.jwt()) as string
    const identityUrl = `${window.location.origin}${IDENTITY_PATH}`

    const res = await fetch(`${identityUrl}/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ email_change_token: token }),
    })

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as GoTrueErrorBody
      throw new AuthError(errorBody.msg ?? `Email change verification failed (${String(res.status)})`, res.status)
    }

    const userData = (await res.json()) as UserData
    const user = toUser(userData)
    emitAuthEvent(AUTH_EVENTS.USER_UPDATED, user)
    return user
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw AuthError.from(error)
  }
}

/**
 * Updates the current user's email, password, or user metadata.
 * Auto-hydrates from auth cookies if no browser session exists.
 *
 * @param updates - Fields to update. Pass `email` or `password` to change credentials,
 *   or `data` to update user metadata (e.g., `{ data: { full_name: 'New Name' } }`).
 * @throws {AuthError} If no user is logged in or the update fails.
 */
export const updateUser = async (updates: UserUpdates): Promise<User> => {
  const currentUser = await resolveCurrentUser()

  try {
    const updatedUser = await currentUser.update(updates)
    const user = toUser(updatedUser)
    emitAuthEvent(AUTH_EVENTS.USER_UPDATED, user)
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}
