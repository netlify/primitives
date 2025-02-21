import * as HEADERS from '../headers.js'

const CACHE_DURABLE = 'netlify durable'
const CACHE_EDGE = 'netlify edge'

interface CacheStatus {
  /**
   * Whether the response was served from a Netlify cache.
   */
  hit: boolean

  /**
   * Granular information about how the different Netlify caches have
   * contributed to the delivery of the response.
   */
  caches: {
    /**
     * How the response has interacted with the durable cache.
     *
     * {@link} https://ntl.fyi/durable
     */
    durable?: {
      hit: boolean
      fresh: boolean
      stored?: boolean
      ttl: number
    }

    /**
     * How the response has interacted with the edge cache.
     *
     * {@link} https://ntl.fyi/edge-cache
     */
    edge?: {
      hit: boolean
      fresh: boolean
    }
  }
}

export const parseCacheStatusValue = (value: string) => {
  const parts = value.split(';').map((part) => part.trim())
  const [namePart, ...attributeParts] = parts
  const name = (namePart ?? '').replace(/"/g, '').toLowerCase()
  const attributes = attributeParts.reduce((acc, part) => {
    const [key, value = ''] = part.split('=')

    return {
      ...acc,
      [key]: value,
    }
  }, {} as Record<string, string>)

  return {
    attributes,
    name,
  }
}

export const parseCacheStatusValues = (cacheStatusValues: string): CacheStatus | null => {
  const cacheStatus: CacheStatus = {
    hit: false,
    caches: {},
  }

  for (const value of cacheStatusValues.split(',')) {
    const { attributes, name } = parseCacheStatusValue(value)

    if (name === CACHE_EDGE) {
      const hit = attributes.hit !== undefined

      cacheStatus.caches.edge = {
        hit,
        fresh: hit && attributes.fwd !== 'stale',
      }

      cacheStatus.hit = cacheStatus.hit || hit

      continue
    }

    if (name === CACHE_DURABLE) {
      let ttl = 0

      if (attributes.ttl !== undefined) {
        const parsedTTL = Number.parseInt(attributes.ttl)

        if (!Number.isNaN(parsedTTL)) {
          ttl = parsedTTL
        }
      }

      const hit = attributes.hit !== undefined

      cacheStatus.caches.durable = {
        hit,
        fresh: hit && attributes.fwd !== 'stale',
        stored: attributes.stored === 'true',
        ttl,
      }

      cacheStatus.hit = cacheStatus.hit || hit

      continue
    }
  }

  if (Object.keys(cacheStatus.caches).length === 0) {
    return null
  }

  return cacheStatus
}

type ParseCacheStatus = {
  (header: string): CacheStatus | null
  (headers: Headers): CacheStatus | null
  (response: Response): CacheStatus | null
}

/**
 * Retrieves information about how a response has interacted with Netlify's
 * global caching infrastructure, including whether the response has been
 * served by a cache and whether it's fresh or stale.
 */
export const getCacheStatus: ParseCacheStatus = (input: string | Headers | Response): CacheStatus | null => {
  if (typeof input === 'string') {
    return parseCacheStatusValues(input)
  }

  if (input instanceof Headers) {
    return parseCacheStatusValues(input.get(HEADERS.CacheStatus) ?? '')
  }

  if (input instanceof Response) {
    return parseCacheStatusValues(input.headers.get(HEADERS.CacheStatus) ?? '')
  }

  throw new TypeError('`getCacheStatus` expects a string, a `Headers` object or a `Response` object.')
}
