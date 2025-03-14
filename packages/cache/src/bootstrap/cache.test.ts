import { Buffer } from 'node:buffer'

import { describe, test, expect, vi } from 'vitest'

import { NetlifyCache } from './cache.js'
import { ERROR_CODES } from './errors.js'
import { getMockFetch } from '../test/fetch.js'
import { decodeHeaders } from '../test/headers.js'

const base64Encode = (input: string) => Buffer.from(input, 'utf8').toString('base64')
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
      const mockFetch = getMockFetch({
        responses: {
          'https://netlify.com/': [response],
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            (_, init) => {
              const headers = init?.headers as Record<string, string>

              expect(headers.Authorization).toBe(`Bearer ${token}`)
              expect(headers['netlify-forwarded-host']).toBe(host)

              return new Response(null, { status: 201 })
            },
          ],
        },
      })
      const cache = new NetlifyCache({
        base64Encode,
        getContext: () => ({ host, token, url }),
        name: 'my-cache',
        userAgent,
      })

      await cache.add('https://netlify.com')

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(2)

      const [resourceRequest, cacheRequest] = mockFetch.requests

      expect(resourceRequest.url).toBe('https://netlify.com/')
      expect(resourceRequest.method).toBe('GET')

      expect(cacheRequest.url).toBe(`${url}/${encodeURIComponent('https://netlify.com/')}`)
      expect(cacheRequest.method).toBe('POST')
      expect(await cacheRequest.text()).toBe('<h1>Hello world</h1>')
      expect(cacheRequest.headers.get('authorization')).toBe(`Bearer ${token}`)
      expect(cacheRequest.headers.get('netlify-programmable-status')).toBe('200')
      expect(cacheRequest.headers.get('netlify-programmable-store')).toBe('my-cache')

      const resourceHeaders = decodeHeaders(cacheRequest.headers.get('netlify-programmable-headers'))

      expect(resourceHeaders.get('content-type')).toBe('text/html')
    })
  })

  describe('delete', () => {
    test('returns a response if there is a matching entry in the cache, otherwise returns undefined', async () => {
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            (_, init) => {
              const headers = init?.headers as Record<string, string>

              expect(headers.Authorization).toBe(`Bearer ${token}`)
              expect(headers['netlify-forwarded-host']).toBe(host)

              return new Response(null, { status: 202 })
            },
          ],
        },
      })
      const cache = new NetlifyCache({
        base64Encode,
        getContext: () => ({ host, token, url }),
        name: 'my-cache',
        userAgent,
      })

      expect(await cache.delete(new Request('https://netlify.com'))).toBe(true)

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(1)
    })
  })

  describe('match', () => {
    test('returns a response if there is a matching entry in the cache, otherwise returns undefined', async () => {
      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            (_, init) => {
              const headers = init?.headers as Record<string, string>

              expect(headers.Authorization).toBe(`Bearer ${token}`)
              expect(headers['netlify-forwarded-host']).toBe(host)

              return response
            },
          ],
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2Fsome-path': [
            (_, init) => {
              return new Response(null, { status: 404 })
            },
          ],
        },
      })
      const cache = new NetlifyCache({
        base64Encode,
        getContext: () => ({ host, token, url }),
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
  })

  describe('put', () => {
    test('adds a response to the cache', async () => {
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            (_, init) => {
              const headers = init?.headers as Record<string, string>

              expect(headers.Authorization).toBe(`Bearer ${token}`)
              expect(headers['netlify-forwarded-host']).toBe(host)

              return new Response(null, { status: 201 })
            },
          ],
        },
      })
      const cache = new NetlifyCache({
        base64Encode,
        getContext: () => ({ host, token, url }),
        name: 'my-cache',
        userAgent,
      })

      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })

      await cache.put(new Request('https://netlify.com'), response)

      mockFetch.restore()

      expect(mockFetch.requests.length).toBe(1)

      const [cacheRequest] = mockFetch.requests

      expect(cacheRequest.url).toBe(`${url}/${encodeURIComponent('https://netlify.com/')}`)
      expect(cacheRequest.method).toBe('POST')
      expect(await cacheRequest.text()).toBe('<h1>Hello world</h1>')
      expect(cacheRequest.headers.get('authorization')).toBe(`Bearer ${token}`)
      expect(cacheRequest.headers.get('netlify-programmable-status')).toBe('200')
      expect(cacheRequest.headers.get('netlify-programmable-store')).toBe('my-cache')

      const resourceHeaders = decodeHeaders(cacheRequest.headers.get('netlify-programmable-headers'))

      expect([...resourceHeaders]).toStrictEqual([...headers])
    })

    test('logs a message when the response is not added to the cache', async () => {
      const consoleWarn = vi.spyOn(globalThis.console, 'warn')
      const mockFetch = getMockFetch({
        responses: {
          'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [
            (_, init) => {
              const headers = init?.headers as Record<string, string>

              expect(headers.Authorization).toBe(`Bearer ${token}`)
              expect(headers['netlify-forwarded-host']).toBe(host)

              return new Response(null, { headers: { 'netlify-programmable-error': 'no_ttl' }, status: 400 })
            },
          ],
        },
      })
      const cache = new NetlifyCache({
        base64Encode,
        getContext: () => ({ host, token, url }),
        name: 'my-cache',
        userAgent,
      })

      const headers = new Headers()
      headers.set('content-type', 'text/html')
      headers.set('x-custom-header', 'foobar')

      const response = new Response('<h1>Hello world</h1>', { headers })

      await cache.put(new Request('https://netlify.com'), response)

      mockFetch.restore()

      expect(consoleWarn).toHaveBeenCalledWith(`Failed to write to the cache: ${ERROR_CODES.no_ttl}`)
      consoleWarn.mockRestore()

      expect(mockFetch.requests.length).toBe(1)
    })
  })
})
