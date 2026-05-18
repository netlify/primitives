import type { UserData } from 'gotrue-js'

import { isBrowser, getIdentityContext } from './environment.js'
import { AuthError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { AdminUserUpdates, CreateUserParams, GoTrueErrorBody, ListUsersOptions } from './types.js'
import { toUser, type User } from './user.js'

const SERVER_ONLY_MESSAGE =
  'Admin operations are server-only. Call admin methods from a Netlify Function or Edge Function, not from browser code.'

/**
 * Validates that a userId is a valid UUID and returns a URL-safe version.
 * Identity user IDs are always UUIDs; rejecting anything else prevents
 * path traversal (e.g., "../../settings") from reaching unintended endpoints.
 */
const sanitizeUserId = (userId: string): string => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    throw new AuthError('User ID is not a valid UUID')
  }
  return encodeURIComponent(userId)
}

/** Throws if called in a browser environment. */
const assertServer = (): void => {
  if (isBrowser()) {
    throw new AuthError(SERVER_ONLY_MESSAGE)
  }
}

/**
 * Returns the operator token and Identity URL for server-side admin requests.
 * @throws {AuthError} If the Identity endpoint URL or operator token is unavailable.
 */
const getAdminAuth = (): { url: string; token: string } => {
  const ctx = getIdentityContext()
  if (!ctx?.url) {
    throw new AuthError('Could not determine the Identity endpoint URL on the server')
  }
  if (!ctx.token) {
    throw new AuthError('Admin operations require an operator token (only available in Netlify Functions)')
  }
  return { url: ctx.url, token: ctx.token }
}

/**
 * Makes an authenticated admin request to the Identity API on the server.
 * @throws {AuthError} If the request fails or the Identity API returns a non-OK status.
 */
const adminFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const { url, token } = getAdminAuth()
  let res: Response
  try {
    res = await fetchWithTimeout(`${url}${path}`, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    throw new AuthError((error as Error).message, undefined, { cause: error })
  }
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new AuthError(
      (errorBody as GoTrueErrorBody).msg ?? `Admin request failed (${String(res.status)})`,
      res.status,
    )
  }
  return res
}

/**
 * Lists all users. Server-only.
 *
 * Calls `GET /admin/users` with the operator token. Pagination
 * options (`page`, `perPage`) are forwarded as query parameters.
 *
 * @throws {AuthError} If called from a browser, or if the operator token is missing.
 */
const listUsers = async (options?: ListUsersOptions): Promise<User[]> => {
  assertServer()

  const params = new URLSearchParams()
  if (options?.page != null) params.set('page', String(options.page))
  if (options?.perPage != null) params.set('per_page', String(options.perPage))
  const query = params.toString()
  const path = `/admin/users${query ? `?${query}` : ''}`

  const res = await adminFetch(path)
  const body = (await res.json()) as { users: UserData[] }
  return body.users.map(toUser)
}

/**
 * Gets a single user by ID. Server-only.
 *
 * Calls `GET /admin/users/:id` with the operator token.
 *
 * @throws {AuthError} If called from a browser, the user is not found,
 *   or the operator token is missing.
 */
const getUser = async (userId: string): Promise<User> => {
  assertServer()
  const sanitizedUserId = sanitizeUserId(userId)
  const res = await adminFetch(`/admin/users/${sanitizedUserId}`)
  const userData = (await res.json()) as UserData
  return toUser(userData)
}

/**
 * Creates a new user. The user is auto-confirmed (no confirmation email is sent).
 * Server-only.
 *
 * The optional `data` fields are forwarded as top-level attributes in the Identity API
 * request body. Accepted fields: `role`, `app_metadata`, `user_metadata`.
 * Any other keys in `data` are silently ignored. `data` cannot override `email`,
 * `password`, or `confirm`.
 *
 * Calls `POST /admin/users` with the operator token.
 *
 * @throws {AuthError} If called from a browser, the email already exists,
 *   or the operator token is missing.
 */
const createUser = async (params: CreateUserParams): Promise<User> => {
  assertServer()

  const body: Record<string, unknown> = {
    email: params.email,
    password: params.password,
    confirm: true,
  }

  if (params.data) {
    const allowedKeys = ['role', 'app_metadata', 'user_metadata'] as const
    for (const key of allowedKeys) {
      if (key in params.data) {
        body[key] = params.data[key]
      }
    }
  }

  const res = await adminFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const userData = (await res.json()) as UserData
  return toUser(userData)
}

/**
 * Updates an existing user by ID. Server-only.
 *
 * Calls `PUT /admin/users/:id` with the operator token.
 *
 * @throws {AuthError} If called from a browser, the user is not found,
 *   the update fails, or the operator token is missing.
 */
const updateUser = async (userId: string, attributes: AdminUserUpdates): Promise<User> => {
  assertServer()
  const sanitizedUserId = sanitizeUserId(userId)

  const body: Record<string, unknown> = {}
  const allowedKeys = ['email', 'password', 'role', 'confirm', 'app_metadata', 'user_metadata'] as const
  for (const key of allowedKeys) {
    if (key in attributes) {
      body[key] = attributes[key]
    }
  }

  const res = await adminFetch(`/admin/users/${sanitizedUserId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  const userData = (await res.json()) as UserData
  return toUser(userData)
}

/**
 * Deletes a user by ID. Server-only.
 *
 * Calls `DELETE /admin/users/:id` with the operator token.
 *
 * @throws {AuthError} If called from a browser, the user is not found,
 *   the deletion fails, or the operator token is missing.
 */
const deleteUser = async (userId: string): Promise<void> => {
  assertServer()
  const sanitizedUserId = sanitizeUserId(userId)
  await adminFetch(`/admin/users/${sanitizedUserId}`, { method: 'DELETE' })
}

/**
 * The admin namespace for privileged user management operations.
 * All methods are server-only and require the operator token
 * (automatically available in Netlify Functions and Edge Functions).
 *
 * Calling any admin method from a browser environment throws an `AuthError`.
 */
export interface Admin {
  /**
   * Lists all users. Server-only.
   *
   * Calls `GET /admin/users` with the operator token. Pagination
   * options (`page`, `perPage`) are forwarded as query parameters.
   *
   * @throws {AuthError} If called from a browser, or if the operator token is missing.
   */
  listUsers: (options?: ListUsersOptions) => Promise<User[]>

  /**
   * Gets a single user by ID. Server-only.
   *
   * Calls `GET /admin/users/:id` with the operator token.
   *
   * @throws {AuthError} If called from a browser, the user is not found,
   *   or the operator token is missing.
   */
  getUser: (userId: string) => Promise<User>

  /**
   * Creates a new user. The user is auto-confirmed (no confirmation email is sent).
   * Server-only.
   *
   * The optional `data` fields are forwarded as top-level attributes in the Identity API
   * request body. Accepted fields: `role`, `app_metadata`, `user_metadata`.
   * Any other keys in `data` are silently ignored. `data` cannot override `email`,
   * `password`, or `confirm`.
   *
   * Calls `POST /admin/users` with the operator token.
   *
   * @throws {AuthError} If called from a browser, the email already exists,
   *   or the operator token is missing.
   */
  createUser: (params: CreateUserParams) => Promise<User>

  /**
   * Updates an existing user by ID. Server-only.
   *
   * Calls `PUT /admin/users/:id` with the operator token.
   *
   * @throws {AuthError} If called from a browser, the user is not found,
   *   the update fails, or the operator token is missing.
   */
  updateUser: (userId: string, attributes: AdminUserUpdates) => Promise<User>

  /**
   * Deletes a user by ID. Server-only.
   *
   * Calls `DELETE /admin/users/:id` with the operator token.
   *
   * @throws {AuthError} If called from a browser, the user is not found,
   *   the deletion fails, or the operator token is missing.
   */
  deleteUser: (userId: string) => Promise<void>
}

export const admin: Admin = { listUsers, getUser, createUser, updateUser, deleteUser }
