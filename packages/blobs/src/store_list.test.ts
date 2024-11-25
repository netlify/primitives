import { Buffer } from 'node:buffer'
import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import { describe, test, expect, beforeAll, afterEach } from 'vitest'

import { MockFetch } from '../test/mock_fetch.js'

import type { ListStoresResponse } from './backend/list_stores.js'
import { listStores } from './main.js'

beforeAll(async () => {
  if (semver.lt(nodeVersion, '18.0.0')) {
    const nodeFetch = await import('node-fetch')

    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.fetch = nodeFetch.default
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Request = nodeFetch.Request
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Response = nodeFetch.Response
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Headers = nodeFetch.Headers
  }
})

afterEach(() => {
  delete env.NETLIFY_BLOBS_CONTEXT
  delete globalThis.netlifyBlobsContext
})

const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const apiToken = 'some token'
const edgeToken = 'some other token'
const edgeURL = 'https://edge.netlify'

describe('listStores', () => {
  describe('With API credentials', () => {
    test('Lists site stores', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(JSON.stringify({ stores: ['site:store1', 'site:store2', 'deploy:deploy1'] })),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A`,
      })

      globalThis.fetch = mockStore.fetch

      const { stores } = await listStores({
        token: apiToken,
        siteID,
      })

      expect(stores).toStrictEqual(['store1', 'store2'])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Paginates automatically', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store1', 'site:store2', 'deploy:6527dfab35be400008332a1a'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store3', 'site:store4', 'deploy:6527dfab35be400008332a1b'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ stores: ['site:store5', 'deploy:6527dfab35be400008332a1c'] })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A&cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const { stores } = await listStores({
        token: apiToken,
        siteID,
      })

      expect(stores).toStrictEqual(['store1', 'store2', 'store3', 'store4', 'store5'])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Supports manual pagination', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store1', 'site:store2', 'deploy:6527dfab35be400008332a1a'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store3', 'site:store4', 'deploy:6527dfab35be400008332a1b'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ stores: ['site:store5', 'deploy:6527dfab35be400008332a1c'] })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A&cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const result: ListStoresResponse = {
        stores: [],
      }

      for await (const entry of listStores({ token: apiToken, siteID, paginate: true })) {
        result.stores.push(...entry.stores)
      }

      expect(result.stores).toStrictEqual(['store1', 'store2', 'store3', 'store4', 'store5'])
      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  test('Handles missing content for auto pagination', async () => {
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${apiToken}` },
      response: new Response('<not found>', { status: 404 }),
      url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A`,
    })

    globalThis.fetch = mockStore.fetch

    const { stores } = await listStores({
      token: apiToken,
      siteID,
    })

    expect(stores).toStrictEqual([])
    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Handles missing content with manual pagination', async () => {
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${apiToken}` },
      response: new Response('<not found>', { status: 404 }),
      url: `https://api.netlify.com/api/v1/blobs/${siteID}?prefix=site%3A`,
    })

    globalThis.fetch = mockStore.fetch

    const result: ListStoresResponse = {
      stores: [],
    }

    for await (const entry of listStores({ token: apiToken, siteID, paginate: true })) {
      result.stores.push(...entry.stores)
    }

    expect(result.stores).toStrictEqual([])
    expect(mockStore.fulfilled).toBeTruthy()
  })

  describe('With edge credentials', () => {
    test('Lists site stores', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(JSON.stringify({ stores: ['site:store1', 'site:store2', 'deploy:deploy1'] })),
        url: `https://edge.netlify/${siteID}?prefix=site%3A`,
      })

      globalThis.fetch = mockStore.fetch

      const { stores } = await listStores({
        edgeURL,
        token: edgeToken,
        siteID,
      })

      expect(stores).toStrictEqual(['store1', 'store2'])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Loads credentials from the environment', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(JSON.stringify({ stores: ['site:store1', 'site:store2', 'deploy:deploy1'] })),
        url: `https://edge.netlify/${siteID}?prefix=site%3A`,
      })

      globalThis.fetch = mockStore.fetch

      const context = {
        edgeURL,
        siteID,
        token: edgeToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      const { stores } = await listStores()

      expect(stores).toStrictEqual(['store1', 'store2'])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Paginates automatically', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store1', 'site:store2', 'deploy:6527dfab35be400008332a1a'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://edge.netlify/${siteID}?prefix=site%3A`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store3', 'site:store4', 'deploy:6527dfab35be400008332a1b'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://edge.netlify/${siteID}?prefix=site%3A&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(JSON.stringify({ stores: ['site:store5', 'deploy:6527dfab35be400008332a1c'] })),
          url: `https://edge.netlify/${siteID}?prefix=site%3A&cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const context = {
        edgeURL,
        siteID,
        token: edgeToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      const { stores } = await listStores()

      expect(stores).toStrictEqual(['store1', 'store2', 'store3', 'store4', 'store5'])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Supports manual pagination', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store1', 'site:store2', 'deploy:6527dfab35be400008332a1a'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://edge.netlify/${siteID}?prefix=site%3A`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              stores: ['site:store3', 'site:store4', 'deploy:6527dfab35be400008332a1b'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://edge.netlify/${siteID}?prefix=site%3A&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(JSON.stringify({ stores: ['site:store5', 'deploy:6527dfab35be400008332a1c'] })),
          url: `https://edge.netlify/${siteID}?prefix=site%3A&cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const context = {
        edgeURL,
        siteID,
        token: edgeToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      const result: ListStoresResponse = {
        stores: [],
      }

      for await (const entry of listStores({ paginate: true })) {
        result.stores.push(...entry.stores)
      }

      expect(result.stores).toStrictEqual(['store1', 'store2', 'store3', 'store4', 'store5'])
      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})
