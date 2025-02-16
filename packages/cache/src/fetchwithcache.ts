import type { NetlifyCache } from './bootstrap/cache.js'
import type { CacheHeadersOptions } from './cache-headers/cache-headers.js'
import { setCacheHeaders } from './cache-headers/cache-headers.js'

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

type CacheOptions = CacheHeadersOptions & {
  cache?: NetlifyCache | string
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
  (request: string | URL | Request, cacheOptions?: CacheOptions): Promise<Response>
  (request: string | URL | Request, init: RequestInit, cacheOptions?: CacheOptions): Promise<Response>
}

export const fetchWithCache: FetchWithCache = async (
  request: string | URL | Request,
  initOrCacheOptions?: RequestInit | CacheOptions,
  maybeCacheOptions?: CacheOptions,
) => {
  let cacheOptions: CacheOptions
  let requestInit: RequestInit

  if (isRequestInit(initOrCacheOptions)) {
    cacheOptions = maybeCacheOptions || {}
    requestInit = initOrCacheOptions
  } else {
    cacheOptions = initOrCacheOptions || {}
    requestInit = {}
  }

  let cache: Cache

  const { cache: cacheParam, onCachePut, ...cacheHeadersOptions } = cacheOptions

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
  const responseForCache = setCacheHeaders(fresh.clone(), cacheHeadersOptions)
  const cachePut = cache.put(request, responseForCache)

  if (onCachePut) {
    await onCachePut(cachePut)
  } else {
    await cachePut
  }

  return fresh
}
