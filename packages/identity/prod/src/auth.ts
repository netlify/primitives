import type GoTrue from 'gotrue-js'
import type { UserData } from 'gotrue-js'
import type { AuthProvider, NetlifyCookies, SignupData, TokenResponse, GoTrueErrorBody } from './types.js'
import { toUser, decodeJwtPayload } from './user.js'

import { getClient, getIdentityContext, isBrowser, IDENTITY_PATH } from './environment.js'
import {
  getCookie,
  setAuthCookies,
  deleteAuthCookies,
  setBrowserAuthCookies,
  deleteBrowserAuthCookies,
  NF_JWT_COOKIE,
  NF_REFRESH_COOKIE,
} from './cookies.js'
import { AuthError } from './errors.js'
import { AUTH_EVENTS, emitAuthEvent } from './events.js'
import { startTokenRefresh, stopTokenRefresh } from './refresh.js'
import { fetchWithTimeout } from './fetch.js'

const getCookies = (): NetlifyCookies => {
  const cookies = globalThis.Netlify?.context?.cookies
  if (!cookies) {
    throw new AuthError('Server-side auth requires Netlify Functions runtime')
  }
  return cookies
}

const getServerIdentityUrl = (): string => {
  const ctx = getIdentityContext()
  if (!ctx?.url) {
    throw new AuthError('Could not determine the Identity endpoint URL on the server')
  }
  return ctx.url
}

/** Persist the session to localStorage so it survives page reloads. */
export const persistSession = true

/**
 * Logs in with email and password. Works in both browser and server contexts.
 *
 * On success, sets `nf_jwt` and `nf_refresh` cookies and returns the authenticated {@link User}.
 * In the browser, also emits a `'login'` event via {@link onAuthChange}.
 *
 * @throws {AuthError} On invalid credentials, network failure, or missing Netlify runtime.
 *
 * @remarks
 * In Next.js server actions, call `redirect()` **after** `login()` returns, not inside a
 * try/catch. Next.js implements `redirect()` by throwing a special error; wrapping it in
 * try/catch will swallow the redirect.
 *
 * @example
 * ```ts
 * // Next.js server action
 * const user = await login(email, password)
 * redirect('/dashboard') // after login, not inside try/catch
 * ```
 */
export const login = async (email: string, password: string): Promise<import('./user.js').User> => {
  if (!isBrowser()) {
    const identityUrl = getServerIdentityUrl()
    const cookies = getCookies()

    const body = new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
    })

    let res: Response
    try {
      res = await fetchWithTimeout(`${identityUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
    } catch (error) {
      throw AuthError.from(error)
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as GoTrueErrorBody
      throw new AuthError(
        errorBody.msg ?? errorBody.error_description ?? `Login failed (${String(res.status)})`,
        res.status,
      )
    }

    const data = (await res.json()) as TokenResponse
    const accessToken = data.access_token

    let userRes: Response
    try {
      userRes = await fetchWithTimeout(`${identityUrl}/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch (error) {
      throw AuthError.from(error)
    }

    if (!userRes.ok) {
      const errorBody = (await userRes.json().catch(() => ({}))) as GoTrueErrorBody
      throw new AuthError(errorBody.msg ?? `Failed to fetch user data (${String(userRes.status)})`, userRes.status)
    }

    const userData = (await userRes.json()) as UserData
    const user = toUser(userData)

    setAuthCookies(cookies, accessToken, data.refresh_token)

    return user
  }

  const client = getClient()

  try {
    const gotrueUser = await client.login(email, password, persistSession)
    const jwt = await gotrueUser.jwt()
    setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token)
    const user = toUser(gotrueUser)
    startTokenRefresh()
    emitAuthEvent(AUTH_EVENTS.LOGIN, user)
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Creates a new account. Works in both browser and server contexts.
 *
 * If autoconfirm is enabled in your Identity settings, the user is logged in immediately:
 * cookies are set and a `'login'` event is emitted. If autoconfirm is **disabled** (the default),
 * the user receives a confirmation email and must click the link before they can log in.
 * In that case, no cookies are set and no auth event is emitted.
 *
 * @throws {AuthError} On duplicate email, validation failure, network error, or missing Netlify runtime.
 */
export const signup = async (email: string, password: string, data?: SignupData): Promise<import('./user.js').User> => {
  if (!isBrowser()) {
    const identityUrl = getServerIdentityUrl()
    const cookies = getCookies()

    let res: Response
    try {
      res = await fetchWithTimeout(`${identityUrl}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data }),
      })
    } catch (error) {
      throw AuthError.from(error)
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as GoTrueErrorBody
      throw new AuthError(errorBody.msg ?? `Signup failed (${String(res.status)})`, res.status)
    }

    const responseData = (await res.json()) as UserData & Partial<TokenResponse>
    const user = toUser(responseData)

    if (responseData.confirmed_at) {
      const accessToken = responseData.access_token
      if (accessToken) {
        setAuthCookies(cookies, accessToken, responseData.refresh_token)
      }
    }

    return user
  }

  const client = getClient()

  try {
    const response = await client.signup(email, password, data)
    const user = toUser(response as UserData)
    if (response.confirmed_at) {
      const jwt = await (response as { jwt?: () => Promise<string> }).jwt?.()
      if (jwt) {
        const refreshToken = (response as { tokenDetails?: () => { refresh_token: string } | null }).tokenDetails?.()
          ?.refresh_token
        setBrowserAuthCookies(jwt, refreshToken)
      }
      startTokenRefresh()
      emitAuthEvent(AUTH_EVENTS.LOGIN, user)
    }
    return user
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Logs out the current user and clears the session. Works in both browser and server contexts.
 *
 * Always deletes `nf_jwt` and `nf_refresh` cookies, even if the server-side token
 * invalidation request fails. In the browser, emits a `'logout'` event via {@link onAuthChange}.
 *
 * @throws {AuthError} On missing Netlify runtime (server) or logout failure (browser).
 */
export const logout = async (): Promise<void> => {
  if (!isBrowser()) {
    const identityUrl = getServerIdentityUrl()
    const cookies = getCookies()

    const jwt = cookies.get(NF_JWT_COOKIE)
    if (jwt) {
      try {
        await fetchWithTimeout(`${identityUrl}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
        })
      } catch {
        // Best-effort: token invalidation may fail, but we always clear cookies below
      }
    }

    deleteAuthCookies(cookies)
    return
  }

  const client = getClient()

  try {
    const currentUser = client.currentUser()
    if (currentUser) {
      await currentUser.logout()
    }
    deleteBrowserAuthCookies()
    stopTokenRefresh()
    emitAuthEvent(AUTH_EVENTS.LOGOUT, null)
  } catch (error) {
    throw AuthError.from(error)
  }
}

/**
 * Initiates an OAuth login by redirecting to the given provider (e.g., `'google'`, `'github'`).
 * The page navigates away; this function never returns normally. Browser only.
 *
 * After the provider redirects back, call {@link handleAuthCallback} on page load
 * to complete the login and obtain the {@link User}.
 *
 * @throws {AuthError} If called on the server.
 */
export const oauthLogin = (provider: AuthProvider): never => {
  if (!isBrowser()) {
    throw new AuthError('oauthLogin() is only available in the browser')
  }
  const client = getClient()

  window.location.href = client.loginExternalUrl(provider)
  throw new AuthError('Redirecting to OAuth provider')
}

/**
 * Result returned by {@link handleAuthCallback} after processing a URL hash.
 *
 * - `'oauth'`: OAuth provider redirect completed. `user` is the authenticated user.
 * - `'confirmation'`: Email confirmed via token. `user` is the confirmed user.
 * - `'recovery'`: Password recovery token redeemed. `user` is logged in but must set a new password.
 * - `'invite'`: Invite token found. `user` is `null`; `token` contains the invite token for {@link acceptInvite}.
 * - `'email_change'`: Email change verified. `user` reflects the updated email.
 *
 * @example
 * ```ts
 * const result = await handleAuthCallback()
 * if (result?.type === 'recovery') {
 *   redirect('/reset-password')
 * } else if (result?.type === 'invite') {
 *   redirect(`/join?token=${result.token}`)
 * }
 * ```
 */
export interface CallbackResult {
  /** The type of auth callback that was processed. */
  type: 'oauth' | 'confirmation' | 'recovery' | 'invite' | 'email_change'
  /** The authenticated user, or `null` for invite callbacks. */
  user: import('./user.js').User | null
  /** The invite token, only present when `type` is `'invite'`. */
  token?: string
}

/**
 * Processes the URL hash after an OAuth redirect, email confirmation, password
 * recovery, invite acceptance, or email change. Call on page load. Browser only.
 * Returns `null` if the hash contains no auth parameters.
 *
 * Call this early in your app's initialization (e.g., in a layout component or
 * root loader), **not** inside a route that requires authentication, because
 * the callback URL must match the page where this function runs.
 *
 * For recovery callbacks (`result.type === 'recovery'`), the user is logged in
 * but has **not** set a new password yet. Your app must check the result type
 * and redirect to a password form that calls `updateUser({ password })`.
 * A `'recovery'` event (not `'login'`) is emitted via {@link onAuthChange}.
 *
 * @throws {AuthError} If the callback token is invalid or the verification request fails.
 */
export const handleAuthCallback = async (): Promise<CallbackResult | null> => {
  if (!isBrowser()) return null

  const hash = window.location.hash.substring(1)
  if (!hash) return null

  const client = getClient()
  const params = new URLSearchParams(hash)

  try {
    const accessToken = params.get('access_token')
    if (accessToken) return await handleOAuthCallback(client, params, accessToken)

    const confirmationToken = params.get('confirmation_token')
    if (confirmationToken) return await handleConfirmationCallback(client, confirmationToken)

    const recoveryToken = params.get('recovery_token')
    if (recoveryToken) return await handleRecoveryCallback(client, recoveryToken)

    const inviteToken = params.get('invite_token')
    if (inviteToken) return handleInviteCallback(inviteToken)

    const emailChangeToken = params.get('email_change_token')
    if (emailChangeToken) return await handleEmailChangeCallback(client, emailChangeToken)

    return null
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw AuthError.from(error)
  }
}

const handleOAuthCallback = async (
  client: GoTrue,
  params: URLSearchParams,
  accessToken: string,
): Promise<CallbackResult> => {
  const refreshToken = params.get('refresh_token') ?? ''
  const expiresIn = parseInt(params.get('expires_in') ?? '', 10)
  const expiresAt = parseInt(params.get('expires_at') ?? '', 10)
  const gotrueUser = await client.createUser(
    {
      access_token: accessToken,
      token_type: (params.get('token_type') ?? 'bearer') as 'bearer',
      expires_in: isFinite(expiresIn) ? expiresIn : 3600,
      expires_at: isFinite(expiresAt) ? expiresAt : Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
    },
    persistSession,
  )
  setBrowserAuthCookies(accessToken, refreshToken || undefined)
  const user = toUser(gotrueUser)
  startTokenRefresh()
  clearHash()
  emitAuthEvent(AUTH_EVENTS.LOGIN, user)
  return { type: 'oauth', user }
}

const handleConfirmationCallback = async (client: GoTrue, token: string): Promise<CallbackResult> => {
  const gotrueUser = await client.confirm(token, persistSession)
  const jwt = await gotrueUser.jwt()
  setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token)
  const user = toUser(gotrueUser)
  startTokenRefresh()
  clearHash()
  emitAuthEvent(AUTH_EVENTS.LOGIN, user)
  return { type: 'confirmation', user }
}

const handleRecoveryCallback = async (client: GoTrue, token: string): Promise<CallbackResult> => {
  const gotrueUser = await client.recover(token, persistSession)
  const jwt = await gotrueUser.jwt()
  setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token)
  const user = toUser(gotrueUser)
  startTokenRefresh()
  clearHash()
  emitAuthEvent(AUTH_EVENTS.RECOVERY, user)
  return { type: 'recovery', user }
}

const handleInviteCallback = (token: string): CallbackResult => {
  clearHash()
  return { type: 'invite', user: null, token }
}

const handleEmailChangeCallback = async (client: GoTrue, emailChangeToken: string): Promise<CallbackResult> => {
  const currentUser = client.currentUser()
  if (!currentUser) {
    throw new AuthError('Email change verification requires an active browser session')
  }

  const jwt = (await currentUser.jwt()) as string
  const identityUrl = `${window.location.origin}${IDENTITY_PATH}`

  const emailChangeRes = await fetch(`${identityUrl}/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ email_change_token: emailChangeToken }),
  })

  if (!emailChangeRes.ok) {
    const errorBody = (await emailChangeRes.json().catch(() => ({}))) as GoTrueErrorBody
    throw new AuthError(
      errorBody.msg ?? `Email change verification failed (${String(emailChangeRes.status)})`,
      emailChangeRes.status,
    )
  }

  const emailChangeData = (await emailChangeRes.json()) as UserData
  const user = toUser(emailChangeData)
  clearHash()
  emitAuthEvent(AUTH_EVENTS.USER_UPDATED, user)
  return { type: 'email_change', user }
}

const clearHash = (): void => {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}

/**
 * Hydrates the browser-side session from server-set auth cookies.
 * Call this on page load when using server-side login to enable browser
 * account operations (updateUser, verifyEmailChange, etc.).
 *
 * No-op if a browser session already exists or no auth cookies are present.
 * No-op on the server.
 */
export const hydrateSession = async (): Promise<import('./user.js').User | null> => {
  if (!isBrowser()) return null

  const client = getClient()
  const currentUser = client.currentUser()
  if (currentUser) {
    startTokenRefresh()
    return toUser(currentUser)
  }

  const accessToken = getCookie(NF_JWT_COOKIE)
  if (!accessToken) return null

  const refreshToken = getCookie(NF_REFRESH_COOKIE) ?? ''

  const decoded = decodeJwtPayload(accessToken)
  const expiresAt = decoded?.exp ?? Math.floor(Date.now() / 1000) + 3600
  const expiresIn = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))

  let gotrueUser
  try {
    gotrueUser = await client.createUser(
      {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: expiresIn,
        expires_at: expiresAt,
        refresh_token: refreshToken,
      },
      persistSession,
    )
  } catch {
    deleteBrowserAuthCookies()
    return null
  }

  const user = toUser(gotrueUser)
  startTokenRefresh()
  emitAuthEvent(AUTH_EVENTS.LOGIN, user)
  return user
}
