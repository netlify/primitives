import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import type { ReadableStream } from 'node:stream/web'

import { describe, test, expect, beforeAll, afterAll } from 'vitest'

import { NetlifyCacheStorage } from './bootstrap/cachestorage.js'
import { fetchWithCache } from './fetchwithcache.js'
import { getMockFetch } from './test/fetch.js'
import { readAsString, sleep } from './test/util.js'
import { decodeHeaders } from './test/headers.js'

const base64Encode = (input: string) => Buffer.from(input, 'utf8').toString('base64')
const host = 'host.netlify'
const url = 'https://example.netlify/.netlify/cache'
const token = 'mock-token'

let originalCaches = globalThis.caches

beforeAll(() => {
  globalThis.caches = new NetlifyCacheStorage({
    base64Encode,
    getHost: () => host,
    getToken: () => token,
    getURL: () => url,
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
    const mockFetch = getMockFetch({
      responses: {
        'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
          new Response(null, { status: 201 }),
          cachedResponse,
        ],
      },
    })
    const resourceURL = 'https://netlify.com'

    const cache = await caches.open('')
    await cache.put(resourceURL, cachedResponse)

    const response = await fetchWithCache(resourceURL)

    expect(await response.text()).toBe('<h1>Hello world</h1>')

    mockFetch.restore()

    expect(mockFetch.requests.length).toBe(2)
  })

  test('Throws when used with a method other than GET', async () => {
    const mockFetch = getMockFetch()
    const resourceURL = 'https://netlify.com'

    expect(() => fetchWithCache(resourceURL, { method: 'POST' })).rejects.toThrowError()
    expect(() => fetchWithCache(resourceURL, { method: 'PUT' })).rejects.toThrowError()
    expect(() => fetchWithCache(new Request(resourceURL, { method: 'POST' }))).rejects.toThrowError()
    expect(() => fetchWithCache(new Request(resourceURL, { method: 'PUT' }))).rejects.toThrowError()

    mockFetch.restore()

    expect(mockFetch.requests.length).toBe(0)
  })

  describe('When not in the cache, fetches the resource and adds it to the cache', () => {
    test('Without a `onCachePut` handler', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const cacheOptions = {
        tags: ['tag1', 'tag2'],
        ttl: 30,
      }
      const ac = new AbortController()
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            new Response(null, { status: 404 }),
            async (_, init) => {
              const headers = decodeHeaders((init?.headers as Record<string, string>)['netlify-programmable-headers'])

              expect(headers.get('netlify-cache-tag')).toBe(cacheOptions.tags.join(', '))
              expect(headers.get('netlify-cdn-cache-control')).toBe(`s-maxage=${cacheOptions.ttl}`)
              expect(await readAsString(Readable.fromWeb(init?.body as ReadableStream<any>))).toBe(
                '<h1>Hello world</h1>',
              )

              return new Promise((resolve) => {
                ac.signal.onabort = () => resolve(new Response(null, { status: 201 }))
              })
            },
            () => new Response('<h1>Hello world</h1>', { headers }),
          ],
          'https://netlify.com/': [() => new Response('<h1>Hello world</h1>', { headers })],
        },
      })
      const resourceURL = 'https://netlify.com'

      // `fetchWithCache` doesn't resolve until the cache put resolves.
      expect(await Promise.race([fetchWithCache(resourceURL, cacheOptions), sleep(50, 'timeout')])).toBe('timeout')

      ac.abort()

      const cached = await fetchWithCache(resourceURL, cacheOptions)
      expect(await cached.text()).toBe('<h1>Hello world</h1>')

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(4)
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
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            new Response(null, { status: 404 }),
            async (_, init) => {
              const headers = decodeHeaders((init?.headers as Record<string, string>)['netlify-programmable-headers'])

              expect(headers.get('netlify-cache-tag')).toBe(cacheOptions.tags.join(', '))
              expect(headers.get('netlify-cdn-cache-control')).toBe(`s-maxage=${cacheOptions.ttl}`)
              expect(await readAsString(Readable.fromWeb(init?.body as ReadableStream<any>))).toBe(
                '<h1>Hello world</h1>',
              )

              return new Promise((resolve) => {
                ac.signal.onabort = () => resolve(new Response(null, { status: 201 }))
              })
            },
            () => new Response('<h1>Hello world</h1>', { headers }),
          ],
          'https://netlify.com/': [() => new Response('<h1>Hello world</h1>', { headers })],
        },
      })
      const resourceURL = 'https://netlify.com'

      let onCachePutCalled = false

      // `fetchWithCache` resolves without the the cache put having resolved.
      const fresh = await fetchWithCache(resourceURL, {
        ...cacheOptions,
        onCachePut: () => {
          onCachePutCalled = true
        },
      })
      expect(await fresh.text()).toBe('<h1>Hello world</h1>')

      expect(ac.signal.aborted).toBe(false)
      expect(onCachePutCalled).toBe(true)

      ac.abort()

      const cached = await fetchWithCache(resourceURL, cacheOptions)
      expect(await cached.text()).toBe('<h1>Hello world</h1>')

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(4)
    })
  })
})
