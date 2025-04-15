import type { NetlifyCache } from './bootstrap/cache.js'
import { setCacheHeaders } from './cache-headers/cache-headers.js'
import type { CacheSettings } from './cache-headers/options.js'
import { caches } from './polyfill.js'

const requestInitOptions = [
  'method',
  'keepalive',
  'headers',
  'body',
  'redirect',
  'integrity',
  'signal',
  'credentials',
  'mode',
  'referrer',
  'referrerPolicy',
  'window',
  'dispatcher',
  'duplex',
]

type CacheOptions = CacheSettings & {
  /**
   * A `Cache` instance or the name of the cache that should be used. If not
   * set, a cache without a name (i.e. `""`) will be used.
   */
  cache?: NetlifyCache | string

  /**
   * When `fetchWithCache` fetches a new response and adds it to the cache, the
   * `Promise` it returns waits for both the network call to finish and for the
   * response to be cached. Customize this behavior by setting a `onCachePut`
   * handler that receives the cache write `Promise`, giving you the option to
   * handle it as you like. This lets you remove the cache write from the "hot
   * path" and run it in the background.
   */
  onCachePut?: (cachePut: Promise<void>) => void | Promise<void>
}

const isRequestInit = (input: any): input is RequestInit => {
  if (typeof input !== 'object') {
    return false
  }

  for (const property of requestInitOptions) {
    if (property in input) {
      return true
    }
  }

  return false
}

type FetchWithCache = {
  (request: string | URL | Request, init?: RequestInit): Promise<Response>
  (request: string | URL | Request, cacheSettings?: CacheOptions): Promise<Response>
  (request: string | URL | Request, init: RequestInit, cacheSettings?: CacheOptions): Promise<Response>
}

/**
 * Serves a resource from the Cache API if available, otherwise it's fetched
 * from the network and added to the cache. It's a drop-in replacement for
 * `fetch`, supporting the same arguments and return value. A third (optional)
 * argument makes it possible to set the caching configuration of the response
 * as it's added to the cache, overridding any cache control settings it sets.
 * It returns a `Promise` that resolves with the resulting `Response` object,
 * whether it comes from the cache or from the network.
 */
export const fetchWithCache: FetchWithCache = async (
  request: string | URL | Request,
  optionsOrCacheSettings?: RequestInit | CacheSettings,
  cacheOptionsParam?: CacheOptions,
) => {
  let cacheOptions: CacheOptions
  let requestInit: RequestInit

  if (isRequestInit(optionsOrCacheSettings)) {
    cacheOptions = cacheOptionsParam || {}
    requestInit = optionsOrCacheSettings
  } else {
    cacheOptions = optionsOrCacheSettings || {}
    requestInit = {}
  }

  let method: string | undefined

  if (request instanceof Request) {
    method = request.method
  } else {
    method = requestInit?.method
  }

  if (method && method?.toLowerCase() !== 'get') {
    throw new TypeError('`fetchWithCache` only supports GET requests.')
  }

  let cache: Cache

  const { cache: cacheParam, onCachePut, ...cacheSettings } = cacheOptions

  if (cacheParam) {
    if (typeof cacheParam === 'string') {
      cache = await caches.open(cacheParam)
    } else if (cacheParam instanceof Cache) {
      cache = cacheParam
    } else {
      throw new TypeError('`cache` must be a string representing the cache name or an instance of `Cache`.')
    }
  } else {
    cache = await caches.open('')
  }

  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const fresh = await fetch(request, requestInit)
  const responseForCache = setCacheHeaders(fresh.clone(), cacheSettings)
  const cachePut = cache.put(request, responseForCache)

  if (onCachePut) {
    await onCachePut(cachePut)
  } else {
    await cachePut
  }

  return fresh
}
