import { getEnvironment } from '@netlify/runtime-utils'

import type { Fetcher } from './types.ts'

const DEFAULT_RETRY_DELAY = getEnvironment().get('NODE_ENV') === 'test' ? 1 : 5000
const MIN_RETRY_DELAY = 1000
const MAX_RETRY = 5
const RATE_LIMIT_HEADER = 'X-RateLimit-Reset'

export type GetRetryUrl = () => Promise<string>

export const fetchAndRetry = async (
  fetch: Fetcher,
  url: string,
  options: RequestInit,
  attemptsLeft = MAX_RETRY,
  getRetryUrl?: GetRetryUrl,
): ReturnType<typeof globalThis.fetch> => {
  try {
    const res = await fetch(url, options)

    // A 403 is only treated as retryable for signed-URL requests, where it
    // almost always means the URL expired before we got to it, rather than a
    // genuine permissions error (those are caught earlier, when the signed
    // URL itself is requested from the Netlify API).
    const isRetryable = res.status === 429 || res.status >= 500 || (getRetryUrl !== undefined && res.status === 403)

    if (attemptsLeft > 0 && isRetryable) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER))
      await sleep(delay)
      const retryUrl = getRetryUrl ? await getRetryUrl() : url
      return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl)
    }

    return res
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error
    }

    const delay = getDelay()
    await sleep(delay)
    const retryUrl = getRetryUrl ? await getRetryUrl() : url
    return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl)
  }
}

const getDelay = (rateLimitReset?: string | null) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY
  }

  return Math.max(Number(rateLimitReset) * 1000 - Date.now(), MIN_RETRY_DELAY)
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
