import type { NetlifyCookies } from './types.js'

export const NF_JWT_COOKIE = 'nf_jwt'
export const NF_REFRESH_COOKIE = 'nf_refresh'

/** Reads a cookie value from `document.cookie` by name. Returns `null` if not found or not in a browser. */
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const match = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`).exec(document.cookie)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/** Sets the `nf_jwt` and (optionally) `nf_refresh` auth cookies via the Netlify runtime. */
export const setAuthCookies = (cookies: NetlifyCookies, accessToken: string, refreshToken?: string): void => {
  cookies.set({
    name: NF_JWT_COOKIE,
    value: accessToken,
    httpOnly: false,
    secure: true,
    path: '/',
    sameSite: 'Lax',
  })

  if (refreshToken) {
    // httpOnly: false because browser-side hydration (backgroundHydrate, hydrateSession)
    // reads nf_refresh via document.cookie to bootstrap the gotrue-js session.
    cookies.set({
      name: NF_REFRESH_COOKIE,
      value: refreshToken,
      httpOnly: false,
      secure: true,
      path: '/',
      sameSite: 'Lax',
    })
  }
}

/** Deletes both auth cookies via the Netlify runtime. */
export const deleteAuthCookies = (cookies: NetlifyCookies): void => {
  cookies.delete(NF_JWT_COOKIE)
  cookies.delete(NF_REFRESH_COOKIE)
}

/** Sets auth cookies via document.cookie (browser-side). No-op on the server. */
export const setBrowserAuthCookies = (accessToken: string, refreshToken?: string): void => {
  if (typeof document === 'undefined') return
  document.cookie = `${NF_JWT_COOKIE}=${encodeURIComponent(accessToken)}; path=/; secure; samesite=lax`
  if (refreshToken) {
    document.cookie = `${NF_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; path=/; secure; samesite=lax`
  }
}

/** Deletes auth cookies via document.cookie (browser-side). No-op on the server. */
export const deleteBrowserAuthCookies = (): void => {
  if (typeof document === 'undefined') return
  document.cookie = `${NF_JWT_COOKIE}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  document.cookie = `${NF_REFRESH_COOKIE}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

/** Reads a cookie from the server-side Netlify runtime. Returns `null` if not available. */
export const getServerCookie = (name: string): string | null => {
  const cookies = globalThis.Netlify?.context?.cookies
  if (!cookies || typeof cookies.get !== 'function') return null
  return cookies.get(name) ?? null
}
