import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import { describe, test, expect, beforeAll, afterEach } from 'vitest'

import { MockFetch } from '../test/mock_fetch.js'

import { getStore } from './main.js'
import type { ListResult } from './store.js'

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
})

const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const storeName = 'mystore'
const apiToken = 'some token'
const edgeToken = 'some other token'
const edgeURL = 'https://edge.netlify'

describe('list', () => {
  describe('With API credentials', () => {
    test('Lists blobs and handles pagination by default', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag4',
                  key: 'key4',
                  size: 4,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag5',
                  key: 'key5',
                  size: 5,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        name: 'mystore',
        token: apiToken,
        siteID,
      })

      const { blobs } = await store.list()

      expect(blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
        { etag: 'etag4', key: 'key4' },
        { etag: 'etag5', key: 'key5' },
      ])

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `directories` parameter', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir1'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?directories=true`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag4',
                  key: 'key4',
                  size: 4,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir2'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?directories=true&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag5',
                  key: 'key5',
                  size: 5,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir3'],
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?directories=true&cursor=cursor_2`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag6',
                  key: 'key6',
                  size: 6,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?prefix=dir2%2F&directories=true`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        name: 'mystore',
        token: apiToken,
        siteID,
      })

      const root = await store.list({ directories: true })

      expect(root.blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
        { etag: 'etag4', key: 'key4' },
        { etag: 'etag5', key: 'key5' },
      ])

      expect(root.directories).toEqual(['dir1', 'dir2', 'dir3'])

      const directory = await store.list({ directories: true, prefix: `dir2/` })

      expect(directory.blobs).toEqual([{ etag: 'etag6', key: 'key6' }])
      expect(directory.directories).toEqual([])

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `prefix` property', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(
          JSON.stringify({
            blobs: [
              {
                etag: 'etag1',
                key: 'group/key1',
                size: 1,
                last_modified: '2023-07-18T12:59:06Z',
              },
              {
                etag: 'etag2',
                key: 'group/key2',
                size: 2,
                last_modified: '2023-07-18T12:59:06Z',
              },
            ],
          }),
        ),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?prefix=group%2F`,
      })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        name: 'mystore',
        token: apiToken,
        siteID,
      })

      const { blobs } = await store.list({
        prefix: 'group/',
      })

      expect(blobs).toEqual([
        { etag: 'etag1', key: 'group/key1' },
        { etag: 'etag2', key: 'group/key2' },
      ])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns an `AsyncIterator` if `paginate: true`', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
            }),
          ),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:${storeName}?cursor=cursor_2`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        name: 'mystore',
        token: apiToken,
        siteID,
      })
      const result: ListResult = {
        blobs: [],
        directories: [],
      }

      for await (const entry of store.list({ paginate: true })) {
        result.blobs.push(...entry.blobs)
        result.directories.push(...entry.directories)
      }

      expect(result.blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
      ])
      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Lists blobs and handles pagination by default', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag4',
                  key: 'key4',
                  size: 4,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag5',
                  key: 'key5',
                  size: 5,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?cursor=cursor_2`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag6',
                  key: 'key6',
                  size: 6,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?prefix=dir2%2F`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        edgeURL,
        name: storeName,
        token: edgeToken,
        siteID,
      })

      const root = await store.list()

      expect(root.blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
        { etag: 'etag4', key: 'key4' },
        { etag: 'etag5', key: 'key5' },
      ])

      expect(root.directories).toEqual([])

      const directory = await store.list({ prefix: 'dir2/' })

      expect(directory.blobs).toEqual([{ etag: 'etag6', key: 'key6' }])
      expect(directory.directories).toEqual([])

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `directories` parameter', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir1'],
              next_cursor: 'cursor_1',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?directories=true`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag4',
                  key: 'key4',
                  size: 4,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir2'],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?directories=true&cursor=cursor_1`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag5',
                  key: 'key5',
                  size: 5,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: ['dir3'],
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?directories=true&cursor=cursor_2`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag6',
                  key: 'key6',
                  size: 6,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              directories: [],
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?prefix=dir2%2F&directories=true`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        edgeURL,
        name: storeName,
        token: edgeToken,
        siteID,
      })

      const root = await store.list({ directories: true })

      expect(root.blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
        { etag: 'etag4', key: 'key4' },
        { etag: 'etag5', key: 'key5' },
      ])

      expect(root.directories).toEqual(['dir1', 'dir2', 'dir3'])

      const directory = await store.list({ directories: true, prefix: 'dir2/' })

      expect(directory.blobs).toEqual([{ etag: 'etag6', key: 'key6' }])
      expect(directory.directories).toEqual([])

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `prefix` property', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(
          JSON.stringify({
            blobs: [
              {
                etag: 'etag1',
                key: 'group/key1',
                size: 1,
                last_modified: '2023-07-18T12:59:06Z',
              },
              {
                etag: 'etag2',
                key: 'group/key2',
                size: 2,
                last_modified: '2023-07-18T12:59:06Z',
              },
            ],
          }),
        ),
        url: `${edgeURL}/${siteID}/site:${storeName}?prefix=group%2F`,
      })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        edgeURL,
        name: storeName,
        token: edgeToken,
        siteID,
      })

      const { blobs } = await store.list({
        prefix: 'group/',
      })

      expect(blobs).toEqual([
        { etag: 'etag1', key: 'group/key1' },
        { etag: 'etag2', key: 'group/key2' },
      ])
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns an `AsyncIterator` if `paginate: true`', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag1',
                  key: 'key1',
                  size: 1,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag2',
                  key: 'key2',
                  size: 2,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              next_cursor: 'cursor_2',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag3',
                  key: 'key3',
                  size: 3,
                  last_modified: '2023-07-18T12:59:06Z',
                },
                {
                  etag: 'etag4',
                  key: 'key4',
                  size: 4,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
              next_cursor: 'cursor_3',
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?cursor=cursor_2`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(
            JSON.stringify({
              blobs: [
                {
                  etag: 'etag5',
                  key: 'key5',
                  size: 5,
                  last_modified: '2023-07-18T12:59:06Z',
                },
              ],
            }),
          ),
          url: `${edgeURL}/${siteID}/site:${storeName}?cursor=cursor_3`,
        })

      globalThis.fetch = mockStore.fetch

      const store = getStore({
        edgeURL,
        name: storeName,
        token: edgeToken,
        siteID,
      })
      const result: ListResult = {
        blobs: [],
        directories: [],
      }

      for await (const entry of store.list({ paginate: true })) {
        result.blobs.push(...entry.blobs)
        result.directories.push(...entry.directories)
      }

      expect(result.blobs).toEqual([
        { etag: 'etag1', key: 'key1' },
        { etag: 'etag2', key: 'key2' },
        { etag: 'etag3', key: 'key3' },
        { etag: 'etag4', key: 'key4' },
        { etag: 'etag5', key: 'key5' },
      ])
      expect(result.directories).toEqual([])
      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  test('Uses the uncached edge URL if `consistency: "strong"`', async () => {
    const uncachedEdgeURL = 'https://uncached-edge.netlify'
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${edgeToken}` },
      response: new Response(
        JSON.stringify({
          blobs: [
            {
              etag: 'etag1',
              key: 'key1',
              size: 1,
              last_modified: '2023-07-18T12:59:06Z',
            },
            {
              etag: 'etag2',
              key: 'key2',
              size: 2,
              last_modified: '2023-07-18T12:59:06Z',
            },
          ],
          directories: [],
        }),
      ),
      url: `${uncachedEdgeURL}/${siteID}/site:${storeName}`,
    })

    globalThis.fetch = mockStore.fetch

    const store = getStore({
      consistency: 'strong',
      edgeURL,
      name: storeName,
      token: edgeToken,
      siteID,
      uncachedEdgeURL,
    })

    const { blobs, directories } = await store.list()

    expect(blobs).toEqual([
      { etag: 'etag1', key: 'key1' },
      { etag: 'etag2', key: 'key2' },
    ])
    expect(directories).toEqual([])
    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Handles missing content automatic pagination', async () => {
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${edgeToken}` },
      response: new Response('<not_found>', { status: 404 }),
      url: `${edgeURL}/${siteID}/site:${storeName}?prefix=group%2F`,
    })

    globalThis.fetch = mockStore.fetch

    const store = getStore({
      edgeURL,
      name: storeName,
      token: edgeToken,
      siteID,
    })

    const { blobs } = await store.list({
      prefix: 'group/',
    })

    expect(blobs).toEqual([])
    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Handles missing content manual pagination', async () => {
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${edgeToken}` },
      response: new Response('<not_found>', { status: 404 }),
      url: `${edgeURL}/${siteID}/site:${storeName}`,
    })

    globalThis.fetch = mockStore.fetch

    const store = getStore({
      edgeURL,
      name: storeName,
      token: edgeToken,
      siteID,
    })
    const result: ListResult = {
      blobs: [],
      directories: [],
    }

    for await (const entry of store.list({ paginate: true })) {
      result.blobs.push(...entry.blobs)
      result.directories.push(...entry.directories)
    }

    expect(result.blobs).toEqual([])
    expect(result.directories).toEqual([])
    expect(mockStore.fulfilled).toBeTruthy()
  })
})
