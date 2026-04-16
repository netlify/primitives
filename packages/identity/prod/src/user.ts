import type { UserData } from 'gotrue-js'
import { AUTH_PROVIDERS, type AuthProvider } from './types.js'
import { getGoTrueClient, getIdentityContext, isBrowser, IDENTITY_PATH } from './environment.js'
import { getCookie, getServerCookie, NF_JWT_COOKIE } from './cookies.js'
import { triggerNextjsDynamic } from './nextjs.js'
import { fetchWithTimeout } from './fetch.js'
import { hydrateSession } from './auth.js'
import { startTokenRefresh } from './refresh.js'

/** Decoded JWT claims from the Identity token. Used internally to construct {@link User}. */
export interface IdentityUser {
  sub?: string
  email?: string
  exp?: number
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  [key: string]: unknown
}

const toAuthProvider = (value: unknown): AuthProvider | undefined =>
  typeof value === 'string' && (AUTH_PROVIDERS as readonly string[]).includes(value)
    ? (value as AuthProvider)
    : undefined

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const toRoles = (appMeta: Record<string, unknown>): string[] | undefined => {
  const roles = appMeta.roles
  if (Array.isArray(roles) && roles.every((r) => typeof r === 'string')) {
    return roles
  }
  return undefined
}

/**
 * A normalized user object returned by all auth and admin functions.
 * Provides a consistent shape regardless of whether the user was loaded
 * from the Identity API, a JWT cookie, or the server-side identity context.
 *
 * All fields except `id` are optional and may be `undefined`. Empty strings
 * are normalized to `undefined`. State-dependent fields (invite,
 * recovery, email-change) are only present when the user is in that state.
 *
 * @example
 * ```ts
 * const user = await getUser()
 * if (user) {
 *   console.log(user.email, user.name, user.roles)
 * }
 * ```
 */
export interface User {
  /** The user's unique identifier. */
  id: string
  /** The user's email address. */
  email?: string
  /** ISO 8601 timestamp of when the user's email was confirmed. `undefined` if not yet confirmed. */
  confirmedAt?: string
  /** ISO 8601 timestamp of when the account was created. */
  createdAt?: string
  /** ISO 8601 timestamp of the last account update. */
  updatedAt?: string
  /**
   * The account-level role string (e.g., `"admin"`). This is a single value
   * set via the admin API, distinct from `roles` which is an array in `app_metadata`.
   * `undefined` when not set or empty.
   */
  role?: string
  /** The authentication provider used to create the account (from `app_metadata.provider`). */
  provider?: AuthProvider
  /** Display name from `user_metadata.full_name` or `user_metadata.name`. */
  name?: string
  /** Avatar URL from `user_metadata.avatar_url`. */
  pictureUrl?: string
  /** Application-level roles from `app_metadata.roles`, set via the admin API or Netlify UI. */
  roles?: string[]
  /** ISO 8601 timestamp of when the user was invited. Only present if the user was created via invitation. */
  invitedAt?: string
  /** ISO 8601 timestamp of when the confirmation email was last sent. */
  confirmationSentAt?: string
  /** ISO 8601 timestamp of when the recovery email was last sent. */
  recoverySentAt?: string
  /** The pending email address during an email change flow. Only present while the change is awaiting confirmation. */
  pendingEmail?: string
  /** ISO 8601 timestamp of when the email change verification was last sent. */
  emailChangeSentAt?: string
  /** ISO 8601 timestamp of the user's most recent sign-in. */
  lastSignInAt?: string
  /** Custom user metadata. Contains profile data like `full_name` and `avatar_url`, and any custom fields set via `updateUser()`. */
  userMetadata?: Record<string, unknown>
  /** Application metadata managed by the server. Contains `provider`, `roles`, and other system-managed fields. */
  appMetadata?: Record<string, unknown>
}

export const toUser = (userData: UserData): User => {
  const userMeta = userData.user_metadata ?? {}
  const appMeta = userData.app_metadata ?? {}
  const name = userMeta.full_name ?? userMeta.name
  const pictureUrl = userMeta.avatar_url

  return {
    id: userData.id,
    email: userData.email,
    confirmedAt: toOptionalString(userData.confirmed_at),
    createdAt: userData.created_at,
    updatedAt: userData.updated_at,
    role: toOptionalString(userData.role),
    provider: toAuthProvider(appMeta.provider),
    name: typeof name === 'string' ? name : undefined,
    pictureUrl: typeof pictureUrl === 'string' ? pictureUrl : undefined,
    roles: toRoles(appMeta),
    invitedAt: toOptionalString(userData.invited_at),
    confirmationSentAt: toOptionalString(userData.confirmation_sent_at),
    recoverySentAt: toOptionalString(userData.recovery_sent_at),
    pendingEmail: toOptionalString(userData.new_email),
    emailChangeSentAt: toOptionalString(userData.email_change_sent_at),
    lastSignInAt: toOptionalString(userData.last_sign_in_at),
    userMetadata: userMeta,
    appMetadata: appMeta,
  }
}

/**
 * Converts JWT claims into a User. Used as a fallback when the full user
 * object is unavailable (e.g., Identity API is unreachable on the server).
 *
 * JWT claims only contain `sub`, `email`, `exp`, `app_metadata`, and
 * `user_metadata`. All other User fields (timestamps, aud, role, etc.)
 * will be `undefined`.
 */
const claimsToUser = (claims: IdentityUser): User => {
  const appMeta = claims.app_metadata ?? {}
  const userMeta = claims.user_metadata ?? {}
  const name = userMeta.full_name ?? userMeta.name
  const pictureUrl = userMeta.avatar_url

  return {
    id: claims.sub ?? '',
    email: claims.email,
    provider: toAuthProvider(appMeta.provider),
    name: typeof name === 'string' ? name : undefined,
    pictureUrl: typeof pictureUrl === 'string' ? pictureUrl : undefined,
    roles: toRoles(appMeta),
    userMetadata: userMeta,
    appMetadata: appMeta,
  }
}

/** Decodes a JWT payload without verifying the signature. */
export const decodeJwtPayload = (token: string): IdentityUser | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload) as IdentityUser
  } catch {
    return null
  }
}

/**
 * Fetches the full user object from the Identity API using the JWT.
 * Returns null if the fetch fails (API unreachable, invalid token, etc.).
 */
const fetchFullUser = async (identityUrl: string, jwt: string): Promise<User | null> => {
  try {
    const res = await fetchWithTimeout(`${identityUrl}/user`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!res.ok) return null
    const userData = (await res.json()) as UserData
    return toUser(userData)
  } catch {
    return null
  }
}

/**
 * Resolves the Identity URL from available sources, or null if not discoverable.
 */
const resolveIdentityUrl = (): string | null => {
  const identityContext = getIdentityContext()
  if (identityContext?.url) return identityContext.url

  if (globalThis.Netlify?.context?.url) {
    return new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href
  }

  const siteUrl = typeof process !== 'undefined' ? process.env?.URL : undefined
  if (siteUrl) {
    return new URL(IDENTITY_PATH, siteUrl).href
  }

  return null
}

/**
 * Returns the currently authenticated user, or `null` if not logged in.
 * Never throws; returns `null` on any failure.
 *
 * Always returns a full {@link User} object with all available fields
 * (email, roles, timestamps, metadata, etc.) regardless of whether the
 * call happens in the browser or on the server.
 *
 * In the browser, checks localStorage first. If no localStorage
 * session exists, hydrates from the `nf_jwt` cookie (set by server-side login).
 *
 * On the server, fetches the full user from the Identity API using the JWT from
 * the request. Falls back to JWT claims if the Identity API is unreachable.
 *
 * On the server in a Next.js App Router context, calls `headers()` from
 * `next/headers` to opt the route into dynamic rendering. Without this,
 * Next.js may statically cache the page at build time.
 */
export const getUser = async (): Promise<User | null> => {
  if (isBrowser()) {
    const client = getGoTrueClient()
    const currentUser = client?.currentUser() ?? null

    if (currentUser) {
      // If gotrue-js has a localStorage session but the nf_jwt cookie is gone,
      // the server logged us out. Clear the stale localStorage session.
      const jwt = getCookie(NF_JWT_COOKIE)
      if (!jwt) {
        try {
          currentUser.clearSession()
        } catch {
          // best-effort cleanup
        }
        return null
      }
      startTokenRefresh()
      return toUser(currentUser)
    }

    // No gotrue-js session but cookie exists: hydrate to get the full user
    const jwt = getCookie(NF_JWT_COOKIE)
    if (!jwt) return null

    // Verify the cookie contains a decodable JWT before attempting hydration
    const claims = decodeJwtPayload(jwt)
    if (!claims) return null

    const hydrated = await hydrateSession()
    return hydrated ?? null
  }

  // Trigger Next.js dynamic rendering if in a Next.js RSC context
  triggerNextjsDynamic()

  // Get the JWT from the identity context header or cookie
  const identityContext = globalThis.netlifyIdentityContext
  const serverJwt = identityContext?.token ?? getServerCookie(NF_JWT_COOKIE)

  // Try to fetch the full user from GoTrue for a complete User object
  if (serverJwt) {
    const identityUrl = resolveIdentityUrl()
    if (identityUrl) {
      const fullUser = await fetchFullUser(identityUrl, serverJwt)
      if (fullUser) return fullUser
    }
  }

  // Fallback: only use server-validated identity context, never decode an unverified cookie
  const claims = identityContext?.user ?? null
  return claims ? claimsToUser(claims) : null
}

/**
 * Returns `true` if a user is currently authenticated.
 * Never throws; returns `false` on any failure.
 */
export const isAuthenticated = async (): Promise<boolean> => (await getUser()) !== null
