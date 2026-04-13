/** The supported OAuth and authentication providers. */
export const AUTH_PROVIDERS = ['google', 'github', 'gitlab', 'bitbucket', 'facebook', 'email'] as const

/** A supported authentication provider name (e.g., `'google'`, `'github'`, `'email'`). */
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]

/**
 * Provider and role metadata stored in a user's `app_metadata` field.
 * The `provider` field is set automatically on signup; `roles` controls authorization.
 * Additional keys may be present depending on your Identity configuration.
 *
 * @example
 * ```ts
 * const meta: AppMetadata = {
 *   provider: 'github',
 *   roles: ['admin'],
 *   custom_claim: 'value',
 * }
 * ```
 */
export interface AppMetadata {
  provider: AuthProvider
  roles?: string[]
  [key: string]: unknown
}

/**
 * Identity endpoint configuration for the current environment.
 * In the browser, `url` is derived from `window.location.origin`.
 * On the server, `token` is the operator token for admin operations.
 */
export interface IdentityConfig {
  /** The Identity API endpoint URL (e.g., `https://example.com/.netlify/identity`). */
  url: string
  /** Operator token for server-side admin requests. Only available in Netlify Functions. */
  token?: string
}

/**
 * Project-level Identity settings returned by {@link getSettings}.
 * Reflects the configuration in your Netlify dashboard.
 */
export interface Settings {
  /** Whether new signups are auto-confirmed (no confirmation email sent). */
  autoconfirm: boolean
  /** Whether new signups are disabled entirely. */
  disableSignup: boolean
  /** Map of provider names to whether they are enabled. */
  providers: Record<AuthProvider, boolean>
}

/**
 * Fields accepted by {@link updateUser}. All fields are optional.
 * Pass `data` to update user metadata (e.g., `{ data: { full_name: 'New Name' } }`).
 *
 * @example
 * ```ts
 * await updateUser({ data: { full_name: 'Jane Doe' } })
 * await updateUser({ email: 'new@example.com' })
 * await updateUser({ password: 'new-password' })
 * ```
 */
export interface UserUpdates {
  email?: string
  password?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * User metadata passed during signup (e.g., `{ full_name: 'Jane Doe' }`).
 * Stored in the user's `user_metadata` field.
 */
export type SignupData = Record<string, unknown>

/** OAuth2 token response from the Identity /token endpoint. */
export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

/**
 * Fields accepted by {@link admin.updateUser}. All fields are optional.
 *
 * Unlike {@link UserUpdates} (used by the self-service `updateUser`), admin updates
 * can set `role`, force-confirm a user, and write to `app_metadata`.
 *
 * @example
 * ```ts
 * await admin.updateUser(userId, {
 *   role: 'editor',
 *   confirm: true,
 *   app_metadata: { plan: 'pro' },
 * })
 * ```
 */
export interface AdminUserUpdates {
  email?: string
  password?: string
  /** The user's role (e.g., `'admin'`, `'editor'`). */
  role?: string
  /** Set to `true` to force-confirm the user's email without sending a confirmation email. */
  confirm?: boolean
  /** Server-managed metadata. Only writable via admin operations. */
  app_metadata?: Record<string, unknown>
  /** User-managed metadata (display name, avatar, preferences, etc.). */
  user_metadata?: Record<string, unknown>
}

/** Identity API error response body. */
export interface GoTrueErrorBody {
  msg?: string
  error_description?: string
}

/**
 * Pagination options for {@link admin.listUsers}.
 */
export interface ListUsersOptions {
  /** 1-based page number. */
  page?: number
  /** Number of users per page. */
  perPage?: number
}

/**
 * Parameters for {@link admin.createUser}.
 *
 * The optional `data` fields are forwarded as top-level attributes in the Identity API
 * request body. Only these keys are accepted: `role`, `app_metadata`,
 * `user_metadata`. Any other keys are silently ignored. `data` cannot override
 * `email`, `password`, or `confirm`.
 *
 * @example
 * ```ts
 * await admin.createUser({
 *   email: 'jane@example.com',
 *   password: 'secret',
 *   data: { role: 'editor', user_metadata: { full_name: 'Jane Doe' } },
 * })
 * ```
 */
export interface CreateUserParams {
  email: string
  password: string
  /** Identity user fields: `role`, `app_metadata`, `user_metadata`. Other keys are ignored. */
  data?: Record<string, unknown>
}

/**
 * Cookie interface provided by the Netlify Functions runtime.
 * Used internally for server-side auth cookie management.
 */
export interface NetlifyCookies {
  get(name: string): string | undefined
  set(options: {
    name: string
    value: string
    httpOnly: boolean
    secure: boolean
    path: string
    sameSite: 'Strict' | 'Lax' | 'None'
  }): void
  delete(name: string): void
}
