import type { Fetcher } from './types.ts'

const DEFAULT_RETRY_DELAY = 5000
const MIN_RETRY_DELAY = 1000
const MAX_RETRY = 5
const RATE_LIMIT_HEADER = 'X-RateLimit-Reset'

export const fetchAndRetry = async (
  fetch: Fetcher,
  url: string,
  options: RequestInit,
  attemptsLeft = MAX_RETRY,
): ReturnType<typeof globalThis.fetch> => {
  try {
    const res = await fetch(url, options)

    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER))

      await sleep(delay)

      return fetchAndRetry(fetch, url, options, attemptsLeft - 1)
    }

    return res
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error
    }

    const delay = getDelay()

    await sleep(delay)

    return fetchAndRetry(fetch, url, options, attemptsLeft - 1)
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
