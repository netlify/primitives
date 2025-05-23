import { MockFetch } from '@netlify/dev-utils'
import { describe, test, expect, vi } from 'vitest'

import { NetlifyCache } from './cache.js'
import { Operation } from './environment.js'
import { ERROR_CODES } from './errors.js'
import { decodeHeaders } from '../test/headers.js'

const host = 'my-site.netlify'
const url = 'https://example.netlify/.netlify/cache'
const token = 'mock-token'
const userAgent = 'netlify-functions@1.0.0'

describe('Cache API', () => {
  describe('add', () => {
    test('makes an HTTP request and adds the response to the cache', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })
      const mockFetch = new MockFetch()
        .get({
          url: 'https://netlify.com',
          response,
        })
        .post({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
            expect(headers['netlify-programmable-status']).toBe('200')
            expect(headers['netlify-programmable-store']).toBe('my-cache')

            const decodedHeaders = decodeHeaders(headers['netlify-programmable-headers'])

            expect(decodedHeaders.get('content-type')).toBe('text/html')
          },
          response: new Response(null, { status: 201 }),
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Write)

          return { host, token, url }
        },
        name: 'my-cache',
        userAgent,
      })

      await cache.add('https://netlify.com')

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })
  })

  describe('delete', () => {
    test('returns a response if there is a matching entry in the cache, otherwise returns undefined', async () => {
      const mockFetch = new MockFetch()
        .delete({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
          },
          response: new Response(null, { status: 202 }),
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Delete)

          return { host, token, url }
        },
        name: 'my-cache',
        userAgent,
      })

      expect(await cache.delete(new Request('https://netlify.com'))).toBe(true)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('is a no-op when the `getContext` callback returns `null`', async () => {
      const mockFetch = new MockFetch().inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Delete)

          return null
        },
        name: 'my-cache',
        userAgent,
      })

      expect(await cache.delete(new Request('https://netlify.com'))).toBe(true)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })
  })

  describe('match', () => {
    test('returns a response if there is a matching entry in the cache, otherwise returns undefined', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })
      const mockFetch = new MockFetch()
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
          },
          response,
        })
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2Fsome-path',
          response: new Response(null, { status: 404 }),
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Read)

          return { host, token, url }
        },
        name: 'my-cache',
        userAgent,
      })

      const hitResponse = await cache.match(new Request('https://netlify.com'))
      const missResponse = await cache.match(new Request('https://netlify.com/some-path'))

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(2)

      expect(hitResponse?.status).toBe(200)
      expect(await hitResponse?.text()).toBe('<h1>Hello world</h1>')
      expect(hitResponse?.headers.get('authorization')).toBeNull()
      expect(hitResponse?.headers.get('netlify-programmable-status')).toBeNull()
      expect(hitResponse?.headers.get('netlify-programmable-store')).toBeNull()
      expect([...(hitResponse as Response).headers]).toStrictEqual([...headers])

      expect(missResponse).toBeUndefined()
    })

    test('retains request headers, discarding any forbidden ones', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })
      const mockFetch = new MockFetch()
        .get({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
            expect(headers['x-custom-header']).toBe('foo')
            expect(headers['netlify-programmable-store']).toBe('my-cache')
            expect(headers['netlify-programmable-headers']).toBeUndefined()
          },
          response,
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Read)

          return { host, token, url }
        },
        name: 'my-cache',
        userAgent,
      })

      const cached = await cache.match(
        new Request('https://netlify.com', {
          headers: {
            'X-Custom-Header': 'foo',
            'Netlify-Programmable-Headers': 'forbidden',
            'Netlify-Programmable-Store': 'not the right store',
            'Netlify-Forwarded-Host': 'this would break things',
          },
        }),
      )

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(1)

      expect(cached?.status).toBe(200)
      expect(await cached?.text()).toBe('<h1>Hello world</h1>')
    })

    test('is a no-op when the `getContext` callback returns `null`', async () => {
      const mockFetch = new MockFetch().inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Read)

          return null
        },
        name: 'my-cache',
        userAgent,
      })

      expect(await cache.match(new Request('https://netlify.com'))).toBe(undefined)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })
  })

  describe('put', () => {
    test('adds a response to the cache', async () => {
      const resourceHeaders = new Headers()
      resourceHeaders.set('content-type', 'text/html')
      resourceHeaders.set('x-custom-header', 'foobar')

      const mockFetch = new MockFetch()
        .post({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          body: async (body) => {
            expect(body).toBe('<h1>Hello world</h1>')
          },
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
            expect(headers['netlify-programmable-status']).toBe('200')
            expect(headers['netlify-programmable-store']).toBe('my-cache')

            const decodedHeaders = decodeHeaders(headers['netlify-programmable-headers'])
            expect([...decodedHeaders]).toStrictEqual([...resourceHeaders])
          },
          response: new Response(null, { status: 201 }),
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Write)

          return { host, token, url }
        },
        name: 'my-cache',
        userAgent,
      })

      const response = new Response('<h1>Hello world</h1>', { headers: resourceHeaders })

      await cache.put(new Request('https://netlify.com'), response)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('logs a message when the response is not added to the cache', async () => {
      const logger = vi.fn()
      const mockFetch = new MockFetch()
        .post({
          url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
          headers: (headers) => {
            expect(headers.Authorization).toBe(`Bearer ${token}`)
            expect(headers['netlify-forwarded-host']).toBe(host)
          },
          response: new Response(null, { headers: { 'netlify-programmable-error': 'no_ttl' }, status: 400 }),
        })
        .inject()
      const cache = new NetlifyCache({
        getContext: () => ({ host, logger, token, url }),
        name: 'my-cache',
        userAgent,
      })

      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })

      await cache.put(new Request('https://netlify.com'), response)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)

      expect(logger).toHaveBeenCalledWith(`Failed to write to the cache: ${ERROR_CODES.no_ttl}`)
    })

    test('is a no-op when the `getContext` callback returns `null`', async () => {
      const mockFetch = new MockFetch().inject()
      const cache = new NetlifyCache({
        getContext: ({ operation }) => {
          expect(operation).toBe(Operation.Write)

          return null
        },
        name: 'my-cache',
        userAgent,
      })

      expect(await cache.put(new Request('https://netlify.com'), new Response('Hello world'))).toBe(undefined)

      mockFetch.restore()
      expect(mockFetch.fulfilled).toBe(true)
    })
  })
})
