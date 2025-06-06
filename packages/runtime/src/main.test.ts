import type { NetlifyCacheStorage } from '@netlify/cache/bootstrap'
import { MockFetch } from '@netlify/dev-utils'
import { base64Decode } from '@netlify/runtime-utils'
import { describe, expect, test } from 'vitest'

import type { Context, EnvironmentVariables } from '@netlify/types'
import type { GlobalScope } from './lib/util.js'
import { startRuntime } from './main.js'

describe('`startRuntime`', () => {
  test('Populates environment', async () => {
    const envStore: Record<string, string> = {}
    const env: EnvironmentVariables = {
      delete: (key: string) => delete envStore[key],
      get: (key: string) => envStore[key],
      has: (key: string) => Boolean(envStore[key]),
      set: (key: string, value: string) => (envStore[key] = value),
      toObject: () => envStore,
    }
    const globalScope: GlobalScope = {}
    const blobs = {
      edgeURL: 'https://edge.blobs.netlify',
      primaryRegion: 'us-local-1',
      uncachedEdgeURL: 'https://uncached-edge.blobs.netlify',
      token: 'token123',
    }
    const cacheContext = {
      host: 'host.netlify',
      url: 'https://example.netlify/.netlify/cache',
      token: 'mock-token',
    }
    const cachePurgeToken = 'token321'
    const deployID = 'deploy123'
    const siteID = 'site123'
    const cachedResponseBody = '<html>Hello</html>'
    const mockFetch = new MockFetch()
      .get({
        response: new Response(cachedResponseBody),
        url: 'https://example.netlify/.netlify/cache/https%3A%2F%2Fnetlify.com%2F',
      })
      .inject()
    const requestContext: Context = {
      account: {
        id: 'account123',
      },
      cookies: {
        delete: () => {},
        get: () => '',
        set: () => {},
      },
      deploy: {
        context: 'production',
        id: deployID,
        published: true,
      },
      geo: {},
      ip: '123.4.5.6',
      json: Response.json,
      log: console.log,
      next: async () => new Response('Next'),
      params: {},
      rewrite: async () => new Response('Rewrite'),
      requestId: 'request123',
      server: {
        region: 'us-local-1',
      },
      site: {
        id: siteID,
      },
      url: new URL('http://localhost/hello'),
      waitUntil: () => {},
    }

    startRuntime({
      blobs,
      cache: {
        getCacheAPIContext: () => cacheContext,
        purgeToken: cachePurgeToken,
      },
      deployID,
      env,
      getRequestContext: () => requestContext,
      globalScope,
      siteID,
    })

    const blobsContext = JSON.parse(base64Decode(envStore.NETLIFY_BLOBS_CONTEXT))
    expect(blobsContext).toStrictEqual({
      ...blobs,
      deployID,
      siteID,
    })

    expect(globalScope.Netlify.context).toBe(requestContext)
    expect(envStore.NETLIFY_PURGE_API_TOKEN).toBe(cachePurgeToken)

    expect(globalScope.caches).not.toBeUndefined()
    const cache = await (globalScope.caches as NetlifyCacheStorage).open('my-cache')
    const response = await cache.match('https://netlify.com')

    expect(await response?.text()).toBe(cachedResponseBody)

    mockFetch.restore()
    expect(mockFetch.fulfilled).toBe(true)
  })
})
