import { Buffer } from 'node:buffer'

import { describe, test, expect } from 'vitest'

import { NetlifyCacheStorage } from './bootstrap/cachestorage.js'
import { caches } from './main.js'
import { getMockFetch } from './test/fetch.js'

const base64Encode = (input: string) => Buffer.from(input, 'utf8').toString('base64')
const host = 'host.netlify'
const url = 'https://example.netlify/.netlify/cache'
const token = 'mock-token'

describe('`caches` export', () => {
  test('Provides a no-op cache implementation', async () => {
    const html = '<h1>Hello world</h1>'
    const mockFetch = getMockFetch({
      responses: {
        'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F': [new Response(html)],
      },
    })
    const cache1 = await caches.open('cache1')
    const res1 = await cache1.match('https://netlify.com')
    expect(res1).toBeUndefined()

    globalThis.caches = new NetlifyCacheStorage({
      base64Encode,
      getContext: () => ({ host, token, url }),
    })

    const cache2 = await globalThis.caches.open('cache2')
    const res2 = await cache2.match('https://netlify.com')
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe(html)

    mockFetch.restore()
  })
})
