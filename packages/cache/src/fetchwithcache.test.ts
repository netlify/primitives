import { MockFetch } from '@netlify/dev-utils'
import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest'

import { NetlifyCacheStorage } from './bootstrap/cachestorage.js'
import { fetchWithCache } from './fetchwithcache.js'
import { sleep } from './test/util.js'
import { decodeHeaders } from './test/headers.js'

const host = 'host.netlify'
const url = 'https://example.netlify/.netlify/cache'
const token = 'mock-token'

const originalCaches = globalThis.caches

beforeEach(async () => {
  globalThis.caches = new NetlifyCacheStorage({
    getContext: () => ({ host, token, url }),
  })
})

afterAll(() => {
  globalThis.caches = originalCaches
})

describe('`fetchWithCache`', () => {
  test('Returns the response from cache, if available', async () => {
    const headers = new Headers()
    headers.set('content-type', 'text/html')
    headers.set('x-custom-header', 'foobar')

    const cachedResponse = new Response('<h1>Hello world</h1>', { headers })
    const mockFetch = new MockFetch()
      .post({
        response: new Response(null, { status: 201 }),
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
      })
      .get({
        response: () => cachedResponse,
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
      })
      .inject()
    const resourceURL = 'https://netlify.com'

    const cache = await caches.open('')
    await cache.put(resourceURL, cachedResponse)

    const response = await fetchWithCache(resourceURL)

    expect(await response.text()).toBe('<h1>Hello world</h1>')

    mockFetch.restore()

    expect(mockFetch.requests.length).toBe(2)
  })

  test('Respects request headers', async () => {
    const headers = new Headers()
    headers.set('content-type', 'text/html')
    headers.set('vary', 'x-custom-header')

    const cachedResponse = new Response('<h1>Hello world</h1>', { headers })
    const mockFetch = new MockFetch()
      .post({
        response: new Response(null, { status: 201 }),
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
      })
      .get({
        headers: (headers) => {
          expect(headers.vary).toBe('x-custom-header')
        },
        response: () => cachedResponse,
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
      })
      .inject()
    const resourceURL = 'https://netlify.com'

    const cache = await caches.open('')
    await cache.put(resourceURL, cachedResponse)

    const response = await fetchWithCache(resourceURL, {
      headers: {
        vary: 'x-custom-header',
      },
    })

    expect(await response.text()).toBe('<h1>Hello world</h1>')

    mockFetch.restore()

    expect(mockFetch.requests.length).toBe(2)
  })

  test('Throws when used with a method other than GET', async () => {
    const mockFetch = new MockFetch().inject()
    const resourceURL = 'https://netlify.com'

    expect(() => fetchWithCache(resourceURL, { method: 'POST' })).rejects.toThrowError()
    expect(() => fetchWithCache(resourceURL, { method: 'PUT' })).rejects.toThrowError()
    expect(() => fetchWithCache(new Request(resourceURL, { method: 'POST' }))).rejects.toThrowError()
    expect(() => fetchWithCache(new Request(resourceURL, { method: 'PUT' }))).rejects.toThrowError()

    mockFetch.restore()

    expect(mockFetch.requests.length).toBe(0)
  })

  describe('When not in the cache, fetches the resource and adds it to the cache', () => {
    test('Without a `onCachePut` handler and no `waitUntil` available', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const cacheOptions = {
        tags: ['tag1', 'tag2'],
        ttl: 30,
      }
      const ac = new AbortController()
      const mockFetch = new MockFetch()
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: new Response(null, { status: 404 }),
        })
        .post({
          body: async (body) => {
            expect(body).toBe('<h1>Hello world</h1>')
          },
          headers: async (reqHeaders) => {
            const headers = decodeHeaders(reqHeaders['netlify-programmable-headers'])

            expect(headers.get('netlify-cache-tag')).toBe(cacheOptions.tags.join(', '))
            expect(headers.get('netlify-cdn-cache-control')).toBe(`s-maxage=${cacheOptions.ttl}`)
          },
          response: () =>
            new Promise<Response>((resolve) => {
              ac.signal.onabort = () => resolve(new Response(null, { status: 201 }))
            }),
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
        })
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: () => new Response('<h1>Hello world</h1>', { headers }),
        })
        .get({ url: 'https://netlify.com/', response: new Response('<h1>Hello world</h1>', { headers }) })
        .inject()
      const resourceURL = 'https://netlify.com'

      // `fetchWithCache` doesn't resolve until the cache put resolves.
      expect(await Promise.race([fetchWithCache(resourceURL, cacheOptions), sleep(50, 'timeout')])).toBe('timeout')

      ac.abort()

      const cached = await fetchWithCache(resourceURL, cacheOptions)
      expect(await cached.text()).toBe('<h1>Hello world</h1>')

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('Without a `onCachePut` handler and with `waitUntil` available', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const cacheOptions = {
        tags: ['tag1', 'tag2'],
        ttl: 30,
      }
      const ac = new AbortController()
      const mockFetch = new MockFetch()
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: new Response(null, { status: 404 }),
        })
        .post({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (reqHeaders) => {
            const headers = decodeHeaders(reqHeaders['netlify-programmable-headers'])

            expect(headers.get('netlify-cache-tag')).toBe(cacheOptions.tags.join(', '))
            expect(headers.get('netlify-cdn-cache-control')).toBe(`s-maxage=${cacheOptions.ttl}`)
          },
          response: () =>
            new Promise((resolve) => {
              ac.signal.onabort = () => resolve(new Response(null, { status: 201 }))
            }),
        })
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: new Response('<h1>Hello world</h1>', { headers }),
        })
        .get({
          url: 'https://netlify.com/',
          response: new Response('<h1>Hello world</h1>', { headers }),
        })
        .inject()
      const resourceURL = 'https://netlify.com'
      const waitUntil = vi.fn()

      // @ts-expect-error
      globalThis.Netlify = {
        context: {
          waitUntil,
        },
      }

      // `fetchWithCache` resolves without the cache put having resolved.
      const fresh = await fetchWithCache(resourceURL, cacheOptions)
      expect(await fresh.text()).toBe('<h1>Hello world</h1>')

      // @ts-expect-error
      delete globalThis.Netlify

      expect(ac.signal.aborted).toBe(false)
      expect(waitUntil).toHaveBeenCalledOnce()

      ac.abort()

      const cached = await fetchWithCache(resourceURL, cacheOptions)
      expect(await cached.text()).toBe('<h1>Hello world</h1>')

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('With a `onCachePut` handler', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const cacheOptions = {
        tags: ['tag1', 'tag2'],
        ttl: 30,
      }
      const ac = new AbortController()
      const mockFetch = new MockFetch()
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: new Response(null, { status: 404 }),
        })
        .post({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (reqHeaders) => {
            const headers = decodeHeaders(reqHeaders['netlify-programmable-headers'])

            expect(headers.get('netlify-cache-tag')).toBe(cacheOptions.tags.join(', '))
            expect(headers.get('netlify-cdn-cache-control')).toBe(`s-maxage=${cacheOptions.ttl}`)
          },
          response: () =>
            new Promise((resolve) => {
              ac.signal.onabort = () => resolve(new Response(null, { status: 201 }))
            }),
        })
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          response: new Response('<h1>Hello world</h1>', { headers }),
        })
        .get({
          url: 'https://netlify.com/',
          response: new Response('<h1>Hello world</h1>', { headers }),
        })
        .inject()
      const resourceURL = 'https://netlify.com'
      const onCachePut = vi.fn()

      // `fetchWithCache` resolves without the cache put having resolved.
      const fresh = await fetchWithCache(resourceURL, {
        ...cacheOptions,
        onCachePut,
      })
      expect(await fresh.text()).toBe('<h1>Hello world</h1>')

      expect(ac.signal.aborted).toBe(false)
      expect(onCachePut).toHaveBeenCalledOnce()

      ac.abort()

      const cached = await fetchWithCache(resourceURL, cacheOptions)
      expect(await cached.text()).toBe('<h1>Hello world</h1>')

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })
  })

  test('Uses the exported `caches` proxy', async () => {
    const html = '<h1>Hello world</h1>'
    const mockFetch = new MockFetch()
      .get({
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
        response: new Response(html),
      })
      .get({
        url: 'https://netlify.com/',
        response: new Response(html),
      })
      .inject()
    const resourceURL = 'https://netlify.com'
    const responseWithCache = await fetchWithCache(resourceURL)
    expect(await responseWithCache.text()).toBe('<h1>Hello world</h1>')

    // @ts-expect-error
    delete globalThis.caches

    const responseWithProxy = await fetchWithCache(resourceURL)
    expect(await responseWithProxy.text()).toBe('<h1>Hello world</h1>')

    mockFetch.restore()
    expect(mockFetch.fulfilled).toBe(true)
  })

  test('Accepts a custom `fetch` implementation', async () => {
    const mockFetch = new MockFetch()
      .get({
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
        response: new Response(null, { status: 404 }),
      })
      .post({
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
        response: new Response(null, { status: 201 }),
      })
      .inject()
    const customFetch: typeof globalThis.fetch = async () => new Response('rijwiel')

    const response = await fetchWithCache('https://netlify.com', { fetch: customFetch })
    expect(await response.text()).toBe('rijwiel')

    mockFetch.restore()
    expect(mockFetch.fulfilled).toBe(true)
  })
})
