import GoTrue from 'gotrue-js'

import type { IdentityConfig } from './types.js'
import { MissingIdentityError } from './errors.js'

export const IDENTITY_PATH = '/.netlify/identity'

let goTrueClient: GoTrue | null = null
let cachedApiUrl: string | null | undefined
let warnedMissingUrl = false

export const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.location !== 'undefined'

/**
 * Discovers and caches the Identity API URL.
 *
 * Browser: uses `window.location.origin` + IDENTITY_PATH.
 * Server: reads from `globalThis.netlifyIdentityContext`.
 */
const discoverApiUrl = (): string | null => {
  if (cachedApiUrl !== undefined) return cachedApiUrl

  if (isBrowser()) {
    cachedApiUrl = `${window.location.origin}${IDENTITY_PATH}`
  } else {
    const identityContext = getIdentityContext()
    if (identityContext?.url) {
      cachedApiUrl = identityContext.url
    } else if (globalThis.Netlify?.context?.url) {
      cachedApiUrl = new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href
    } else if (typeof process !== 'undefined' && process.env?.URL) {
      cachedApiUrl = new URL(IDENTITY_PATH, process.env.URL).href
    }
  }

  return cachedApiUrl ?? null
}

/**
 * Returns (and lazily creates) a singleton Identity client.
 * Returns `null` and logs a warning if no identity URL can be discovered.
 */
export const getGoTrueClient = (): GoTrue | null => {
  if (goTrueClient) return goTrueClient

  const apiUrl = discoverApiUrl()
  if (!apiUrl) {
    if (!warnedMissingUrl) {
      console.warn(
        '@netlify/identity: Could not determine the Identity endpoint URL. ' +
          'Make sure your site has Netlify Identity enabled, or run your app with `netlify dev`.',
      )
      warnedMissingUrl = true
    }
    return null
  }

  goTrueClient = new GoTrue({ APIUrl: apiUrl, setCookie: false })
  return goTrueClient
}

/**
 * Returns the singleton Identity client, or throws if Identity is not configured.
 */
export const getClient = (): GoTrue => {
  const client = getGoTrueClient()
  if (!client) throw new MissingIdentityError()
  return client
}

/**
 * Reads the server-side identity context set by the Netlify bootstrap.
 * Returns `null` outside the Netlify serverless environment.
 */
export const getIdentityContext = (): IdentityConfig | null => {
  const identityContext = globalThis.netlifyIdentityContext
  if (identityContext?.url) {
    return {
      url: identityContext.url,
      token: identityContext.token,
    }
  }

  if (globalThis.Netlify?.context?.url) {
    return { url: new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href }
  }

  // Fallback: Netlify sets the URL env var on all deployed sites
  const siteUrl = typeof process !== 'undefined' ? process.env?.URL : undefined
  if (siteUrl) {
    return { url: new URL(IDENTITY_PATH, siteUrl).href }
  }

  return null
}

/** Reset cached state for tests. */
export const resetTestGoTrueClient = (): void => {
  goTrueClient = null
  cachedApiUrl = undefined
  warnedMissingUrl = false
}
