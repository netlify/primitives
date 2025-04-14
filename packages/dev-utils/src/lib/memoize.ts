const DEBOUNCE_INTERVAL = 300

interface CacheEntry<T> {
  enqueued?: boolean
  task: Promise<T>
  timestamp: number
}

export type MemoizeCache<T> = Record<string, CacheEntry<T> | undefined>

interface MemoizeOptions<T> {
  cache: MemoizeCache<T>
  cacheKey: string
  command: () => Promise<T>
}

// `memoize` will avoid running the same build command multiple times
// until the previous operation has been completed. If another call is made
// within that period, it will be:
// - discarded if it happens before `DEBOUNCE_WAIT` has elapsed;
// - enqueued if it happens after `DEBOUNCE_WAIT` has elapsed.
// This allows us to discard any duplicate filesystem events, while ensuring
// that actual updates happening during the zip operation will be executed
// after it finishes (only the last update will run).
/* eslint-disable no-param-reassign */
export const memoize = <T>({ cache, cacheKey, command }: MemoizeOptions<T>) => {
  if (cache[cacheKey] === undefined) {
    cache[cacheKey] = {
      // eslint-disable-next-line promise/prefer-await-to-then
      task: command().finally(() => {
        const entry = cache[cacheKey]

        cache[cacheKey] = undefined

        if (entry?.enqueued !== undefined) {
          memoize({ cache, cacheKey, command })
        }
      }),
      timestamp: Date.now(),
    }
  } else if (Date.now() > cache[cacheKey].timestamp + DEBOUNCE_INTERVAL) {
    cache[cacheKey].enqueued = true
  }

  return cache[cacheKey].task
}
/* eslint-enable no-param-reassign */
