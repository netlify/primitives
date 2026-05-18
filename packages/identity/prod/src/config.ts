import type { AuthProvider, IdentityConfig, Settings } from './types.js'
import { getClient, getIdentityContext, IDENTITY_PATH, isBrowser } from './environment.js'
import { AuthError } from './errors.js'

/**
 * Returns the identity configuration for the current environment.
 * Browser: always returns `{ url }` derived from `window.location.origin`.
 * Server: returns `{ url, token }` from the identity context, or `null` if unavailable.
 * Never throws.
 */
export const getIdentityConfig = (): IdentityConfig | null => {
  if (isBrowser()) {
    return { url: `${window.location.origin}${IDENTITY_PATH}` }
  }

  return getIdentityContext()
}

/**
 * Fetches your project's Identity settings (enabled providers, autoconfirm, signup disabled).
 *
 * @throws {MissingIdentityError} If Identity is not configured.
 * @throws {AuthError} If the endpoint is unreachable.
 */
export const getSettings = async (): Promise<Settings> => {
  const client = getClient()

  try {
    const raw = await client.settings()
    const external: Partial<Record<AuthProvider, boolean>> = raw.external ?? {}
    return {
      autoconfirm: raw.autoconfirm,
      disableSignup: raw.disable_signup,
      providers: {
        google: external.google ?? false,
        github: external.github ?? false,
        gitlab: external.gitlab ?? false,
        bitbucket: external.bitbucket ?? false,
        facebook: external.facebook ?? false,
        email: external.email ?? false,
      },
    }
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : 'Failed to fetch identity settings', 502, { cause: err })
  }
}
