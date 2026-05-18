import { AuthError } from './errors.js'

/**
 * Options for {@link verifyRequestOrigin}.
 */
export interface VerifyRequestOriginOptions {
  /**
   * Origins that are allowed to make state-changing requests to this endpoint.
   *
   * If omitted, the request is only accepted from its own origin (the origin of `request.url`),
   * which is the right default for sites whose login form and login endpoint live on the same origin.
   *
   * Pass an explicit list when you trust additional origins (for example, a separate frontend domain
   * posting to an API on another domain). The list replaces the default, so it must include every
   * origin you want to allow, including the request's own origin if applicable.
   *
   * Each value should be a full origin string with scheme and host: `'https://example.com'`.
   */
  allowedOrigins?: string[]
}

/**
 * Same-origin check for state-changing requests, can be used to defend against Cross-Site Request
 * Forgery (CSRF) on server-side endpoints that call {@link login}, {@link signup}, or {@link logout}.
 *
 * Compares the incoming request's `Origin` header against the request's own origin (or an explicit
 * allowlist via `options.allowedOrigins`) and throws if they don't match. Call this at the start of
 * any server-side handler that performs an auth mutation, before invoking the auth function.
 *
 * The check runs unconditionally on every call: any HTTP method, with or without an `Origin` header.
 * If you don't want the check to apply to a given method or path, simply don't call the helper there.
 *
 * @throws {AuthError} with status `403` when the request has no `Origin` header.
 * @throws {AuthError} with status `403` when the request's `Origin` is not in the allowed origins.
 *
 * @example
 * ```ts
 * // Netlify Function
 * import { login, verifyRequestOrigin } from '@netlify/identity'
 * import type { Context } from '@netlify/functions'
 *
 * export default async (req: Request, context: Context) => {
 *   verifyRequestOrigin(req)
 *   const { email, password } = await req.json()
 *   await login(email, password)
 *   return new Response(null, { status: 302, headers: { Location: '/dashboard' } })
 * }
 * ```
 *
 * @example
 * ```ts
 * // Allow a separate trusted origin (e.g. a marketing site posting to an app domain).
 * // The list replaces the default, so include the request's own origin if you still want it allowed.
 * verifyRequestOrigin(request, {
 *   allowedOrigins: ['https://app.example.com', 'https://www.example.com'],
 * })
 * ```
 */
export const verifyRequestOrigin = (request: Request, options?: VerifyRequestOriginOptions): void => {
  const origin = request.headers.get('origin')
  if (!origin) {
    throw new AuthError('Cross-origin request refused: missing Origin header.', 403)
  }

  const allowed = options?.allowedOrigins ?? [new URL(request.url).origin]
  if (!allowed.includes(origin)) {
    throw new AuthError(`Cross-origin request refused: Origin ${origin} did not match an allowed origin.`, 403)
  }
}
