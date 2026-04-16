import { getGoTrueClient, isBrowser, getIdentityContext, IDENTITY_PATH } from './environment.js'
import {
  NF_JWT_COOKIE,
  NF_REFRESH_COOKIE,
  setBrowserAuthCookies,
  setAuthCookies,
  deleteAuthCookies,
  getServerCookie,
} from './cookies.js'
import { decodeJwtPayload, toUser } from './user.js'
import { AUTH_EVENTS, emitAuthEvent } from './events.js'
import { AuthError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { NetlifyCookies, TokenResponse, GoTrueErrorBody } from './types.js'

/** Seconds before expiry to trigger a refresh. */
const REFRESH_MARGIN_S = 60

let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Starts a browser-side timer that refreshes the access token before it expires
 * and syncs the new token back to the `nf_jwt` cookie. Automatically called by
 * any browser flow that establishes a session (`login`, `signup`,
 * `hydrateSession`, `handleAuthCallback`, `confirmEmail`, `recoverPassword`,
 * `acceptInvite`) and by `getUser` when it finds an existing session.
 * No-op on the server.
 *
 * Safe to call multiple times; restarts the timer with the current token's expiry.
 */
export const startTokenRefresh = (): void => {
  if (!isBrowser()) return
  stopTokenRefresh()

  const client = getGoTrueClient()
  const user = client?.currentUser()
  if (!user) return

  const token = user.tokenDetails()
  if (!token?.expires_at) return

  const nowS = Math.floor(Date.now() / 1000)
  const expiresAtS =
    typeof token.expires_at === 'number' && token.expires_at > 1e12
      ? Math.floor(token.expires_at / 1000) // gotrue-js stores expires_at in ms
      : token.expires_at
  const delayMs = Math.max(0, expiresAtS - nowS - REFRESH_MARGIN_S) * 1000

  refreshTimer = setTimeout(() => {
    void (async () => {
      try {
        const freshJwt = await user.jwt(true)
        const freshDetails = user.tokenDetails()
        setBrowserAuthCookies(freshJwt, freshDetails?.refresh_token)
        emitAuthEvent(AUTH_EVENTS.TOKEN_REFRESH, toUser(user))
        // Schedule next refresh
        startTokenRefresh()
      } catch {
        // Refresh failed (e.g., refresh token revoked). Stop trying.
        stopTokenRefresh()
      }
    })()
  }, delayMs)
}

/**
 * Stops the browser-side auto-refresh timer. Automatically called by `logout`.
 */
export const stopTokenRefresh = (): void => {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Refreshes the session's access token.
 *
 * **Browser:** Token refresh is handled automatically after any browser flow
 * that establishes a session (`login`, `signup`, `hydrateSession`,
 * `handleAuthCallback`, `confirmEmail`, `recoverPassword`, `acceptInvite`)
 * and by `getUser` when it finds an existing session. Calling
 * `refreshSession()` in the browser triggers an
 * immediate refresh if the token is near expiry. Returns the new JWT on
 * success, or `null` if no refresh is needed. Browser-side errors (e.g.,
 * revoked refresh token) do not throw; they return `null`.
 *
 * **Server:** Reads the `nf_jwt` and `nf_refresh` cookies, checks if the token
 * is expired or near expiry, and exchanges the refresh token for a new access
 * token via the Identity `/token` endpoint. Updates both cookies on the response.
 * Call this in framework middleware or at the start of server-side request
 * handlers to ensure subsequent requests carry a valid JWT.
 *
 * Returns the new access token on success, or `null` if no refresh is needed
 * or the refresh token is invalid/missing (400/401).
 *
 * @throws {AuthError} Server-side only: on network failure or when the Identity URL cannot be determined.
 *
 * @example
 * ```ts
 * // In server middleware (e.g., Astro, SvelteKit)
 * import { refreshSession } from '@netlify/identity'
 * await refreshSession()
 * ```
 */
export const refreshSession = async (): Promise<string | null> => {
  if (isBrowser()) {
    const client = getGoTrueClient()
    const user = client?.currentUser()
    if (!user) return null

    // Check if the token is near expiry before refreshing
    const details = user.tokenDetails()
    if (details?.expires_at) {
      const nowS = Math.floor(Date.now() / 1000)
      const expiresAtS =
        typeof details.expires_at === 'number' && details.expires_at > 1e12
          ? Math.floor(details.expires_at / 1000)
          : details.expires_at
      if (expiresAtS - nowS > REFRESH_MARGIN_S) {
        return null
      }
    }

    try {
      const jwt = await user.jwt(true)
      setBrowserAuthCookies(jwt, user.tokenDetails()?.refresh_token)
      emitAuthEvent(AUTH_EVENTS.TOKEN_REFRESH, toUser(user))
      startTokenRefresh()
      return jwt
    } catch {
      stopTokenRefresh()
      return null
    }
  }

  // Server-side: read cookies, check expiry, refresh if needed
  const accessToken = getServerCookie(NF_JWT_COOKIE)
  const refreshToken = getServerCookie(NF_REFRESH_COOKIE)

  if (!accessToken || !refreshToken) return null

  const decoded = decodeJwtPayload(accessToken)
  if (!decoded?.exp) return null

  const nowS = Math.floor(Date.now() / 1000)
  if (decoded.exp - nowS > REFRESH_MARGIN_S) {
    // Token is still valid, no refresh needed
    return null
  }

  // Token is expired or near expiry; exchange refresh token for new access token
  const ctx = getIdentityContext()
  const identityUrl =
    ctx?.url ?? (globalThis.Netlify?.context?.url ? new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href : null)

  if (!identityUrl) {
    throw new AuthError('Could not determine the Identity endpoint URL for token refresh')
  }

  let res: Response
  try {
    res = await fetchWithTimeout(`${identityUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    })
  } catch (error) {
    throw AuthError.from(error)
  }

  if (!res.ok) {
    // Refresh token is invalid/expired; cannot refresh
    const errorBody = (await res.json().catch(() => ({}))) as GoTrueErrorBody
    if (res.status === 401 || res.status === 400) {
      // Invalid refresh token; clear stale cookies so middleware stops retrying
      const cookies = globalThis.Netlify?.context?.cookies as NetlifyCookies | undefined
      if (cookies) {
        deleteAuthCookies(cookies)
      }
      return null
    }
    throw new AuthError(errorBody.msg ?? `Token refresh failed (${String(res.status)})`, res.status)
  }

  const data = (await res.json()) as TokenResponse

  const cookies = globalThis.Netlify?.context?.cookies as NetlifyCookies | undefined
  if (cookies) {
    setAuthCookies(cookies, data.access_token, data.refresh_token)
  }

  return data.access_token
}
