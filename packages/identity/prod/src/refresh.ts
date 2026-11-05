import { getGoTrueClient, isBrowser, getIdentityContext, IDENTITY_PATH } from './environment.js'
import {
  NF_JWT_COOKIE,
  NF_REFRESH_COOKIE,
  getCookie,
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

/** Name of the Web Lock that serializes token refreshes across tabs of the same origin. */
const REFRESH_LOCK = 'netlify-identity-token-refresh'

/** Storage key gotrue-js saves the session under, which every tab of the origin shares. */
const GOTRUE_STORAGE_KEY = 'gotrue.user'

/**
 * How long a tab waits for another tab's refreshed session to arrive before refreshing on its
 * own. The wait ends on that tab's `storage` event, normally within milliseconds; the limit
 * covers an `nf_refresh` cookie that changed for another reason, such as a refresh gotrue-js
 * made by itself without updating the cookie.
 */
const ELSEWHERE_WAIT_MS = 5_000

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let storageListener: ((event: StorageEvent) => void) | null = null

/**
 * When this tab stops waiting for another tab's session, and the refresh token it waits to see
 * replaced. `stopTokenRefresh` leaves it in place, so a wait that starts again for the same
 * token keeps its first deadline.
 */
let elsewhereDeadline: { refreshToken: string | undefined; at: number } | null = null

type RefreshOutcome =
  | { kind: 'refreshed'; jwt: string }
  | { kind: 'no-user' }
  | { kind: 'refreshed-elsewhere'; adopted: boolean }

/**
 * Runs `task` while holding a lock that every tab of this origin shares, or at once where
 * the Web Locks API is unavailable.
 */
const withRefreshLock = async (task: () => Promise<RefreshOutcome>): Promise<RefreshOutcome> => {
  const locks = window.navigator.locks as LockManager | undefined
  if (!locks) return task()
  return await locks.request(REFRESH_LOCK, task)
}

/**
 * Refreshes the session's token, one tab at a time.
 *
 * Every open tab schedules its refresh from the same `expires_at`, so without coordination
 * they send the same refresh token within milliseconds. GoTrue rotates the token on the first
 * request and answers the second with a 400 that also expires the `nf_jwt` cookie, and
 * gotrue-js answers that 400 by removing the session it saved in localStorage, which every
 * tab shares. Every tab is then signed out, though the first refresh succeeded.
 *
 * Inside the lock, the session is read again rather than taken from the caller: a tab that
 * waited reads the one the first tab saved, and skips the refresh when the refresh token it
 * saw before waiting has changed. The `nf_refresh` cookie is checked as well, because the
 * first tab writes it before it releases the lock, while gotrue-js only re-reads localStorage
 * once the `storage` event reaches this tab.
 *
 * @param seenRefreshToken - The refresh token this tab held when it decided to refresh.
 * @param trustCookie - Whether a changed `nf_refresh` cookie counts as another tab's refresh.
 */
const refreshOnce = (seenRefreshToken: string | undefined, trustCookie = true): Promise<RefreshOutcome> =>
  withRefreshLock(async () => {
    const user = getGoTrueClient()?.currentUser()
    if (!user) return { kind: 'no-user' }

    const held = user.tokenDetails()
    if (held?.refresh_token !== seenRefreshToken) {
      // This tab already holds the session another tab refreshed. gotrue-js may have refreshed
      // it without writing the cookies, so they are written here from that session.
      if (held) setBrowserAuthCookies(held.access_token, held.refresh_token)
      return { kind: 'refreshed-elsewhere', adopted: true }
    }
    const cookieRefreshToken = getCookie(NF_REFRESH_COOKIE)
    if (trustCookie && cookieRefreshToken && cookieRefreshToken !== seenRefreshToken) {
      // Another tab refreshed, and its session reaches this tab with the next `storage` event.
      return { kind: 'refreshed-elsewhere', adopted: false }
    }

    const jwt = await user.jwt(true)
    setBrowserAuthCookies(jwt, user.tokenDetails()?.refresh_token)
    emitAuthEvent(AUTH_EVENTS.TOKEN_REFRESH, toUser(user))
    return { kind: 'refreshed', jwt }
  })

/**
 * Schedules the next refresh after another tab refreshed: at once from the session this tab
 * now holds, or once the other tab's session arrives with the `storage` event. If it hasn't
 * arrived within `ELSEWHERE_WAIT_MS`, this tab refreshes on its own, ignoring the cookie.
 *
 * `getUser()` restarts the timer on every call and `refreshSession()` can be called at any
 * time, so the wait often starts again for the same token. It then keeps its first deadline;
 * otherwise calls less than `ELSEWHERE_WAIT_MS` apart would put the refresh off for good.
 */
const followRefreshElsewhere = (adopted: boolean, seenRefreshToken: string | undefined): void => {
  if (adopted) {
    startTokenRefresh()
    return
  }
  stopTokenRefresh()
  if (elsewhereDeadline === null || elsewhereDeadline.refreshToken !== seenRefreshToken) {
    elsewhereDeadline = { refreshToken: seenRefreshToken, at: Date.now() + ELSEWHERE_WAIT_MS }
  }
  const waitMs = Math.max(0, elsewhereDeadline.at - Date.now())
  const onStorage = (event: StorageEvent) => {
    if (event.key !== GOTRUE_STORAGE_KEY) return
    // Stops the fallback below and removes this listener before scheduling from the new session.
    startTokenRefresh()
  }
  window.addEventListener('storage', onStorage)
  storageListener = onStorage
  refreshTimer = setTimeout(() => {
    stopTokenRefresh()
    void runScheduledRefresh(seenRefreshToken, false)
  }, waitMs)
}

/** The timer's refresh: refreshes once, then schedules the next one from the outcome. */
const runScheduledRefresh = async (seenRefreshToken: string | undefined, trustCookie = true): Promise<void> => {
  try {
    const outcome = await refreshOnce(seenRefreshToken, trustCookie)
    if (outcome.kind === 'refreshed') {
      // Schedule next refresh
      startTokenRefresh()
    } else if (outcome.kind === 'refreshed-elsewhere') {
      followRefreshElsewhere(outcome.adopted, seenRefreshToken)
    }
  } catch {
    // Refresh failed (e.g., refresh token revoked). Stop trying.
    stopTokenRefresh()
  }
}

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

  const seenRefreshToken = token.refresh_token

  refreshTimer = setTimeout(() => {
    void runScheduledRefresh(seenRefreshToken)
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
  if (storageListener !== null) {
    window.removeEventListener('storage', storageListener)
    storageListener = null
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
      const outcome = await refreshOnce(details?.refresh_token)
      if (outcome.kind === 'refreshed') {
        startTokenRefresh()
        return outcome.jwt
      }
      if (outcome.kind === 'refreshed-elsewhere') followRefreshElsewhere(outcome.adopted, details?.refresh_token)
      return null
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
