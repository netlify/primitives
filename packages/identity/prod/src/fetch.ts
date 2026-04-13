import { AuthError } from './errors.js'

/** Default timeout for server-side Identity API requests (ms). */
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Wraps `fetch` with an AbortController timeout for server-side requests.
 * If the request doesn't complete within `timeoutMs`, the connection is
 * aborted and an AuthError is thrown.
 *
 * Not exported from the package; used internally by auth, admin, refresh,
 * and user modules for all server-side Identity API calls.
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const pathname = new URL(url).pathname
      throw new AuthError(`Identity request to ${pathname} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
