/**
 * Thrown by auth operations when something goes wrong: invalid credentials,
 * network failures, missing runtime context, etc.
 *
 * The `status` field contains the HTTP status code from the Identity API when available
 * (e.g., 401 for bad credentials, 422 for validation errors).
 * The `cause` field preserves the original error for debugging.
 *
 * @example
 * ```ts
 * try {
 *   await login(email, password)
 * } catch (error) {
 *   if (error instanceof AuthError) {
 *     console.error(error.message, error.status)
 *   }
 * }
 * ```
 */
export class AuthError extends Error {
  override name = 'AuthError'
  /** HTTP status code from the Identity API, if the error originated from an API response. */
  status?: number
  declare cause?: unknown

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message)
    this.status = status
    if (options && 'cause' in options) {
      this.cause = options.cause
    }
  }

  static from(error: unknown): AuthError {
    if (error instanceof AuthError) return error
    const message = error instanceof Error ? error.message : String(error)
    return new AuthError(message, undefined, { cause: error })
  }
}

/**
 * Thrown when a function requires the Identity client but Netlify Identity
 * is not configured (no endpoint URL could be discovered).
 *
 * This typically means the site does not have Identity enabled, or the app
 * is not running via `netlify dev` / deployed on Netlify.
 */
export class MissingIdentityError extends Error {
  override name = 'MissingIdentityError'

  constructor(message = 'Netlify Identity is not available.') {
    super(message)
  }
}
