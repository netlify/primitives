import { Buffer } from 'node:buffer'
import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import { describe, test, expect, beforeAll, afterEach } from 'vitest'

import { MockFetch } from '../test/mock_fetch.js'
import { base64Encode, streamToString } from '../test/util.js'

import { MissingBlobsEnvironmentError } from './environment.js'
import { NF_ERROR, NF_REQUEST_ID } from './headers.js'
import { getDeployStore, getStore, setEnvironmentContext } from './main.js'
import { base64Decode } from './util.js'

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

const deployID = '6527dfab35be400008332a1d'
const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const key = '54321'
const complexKey = 'artist/song'
const value = 'some value'
const apiToken = 'some token'
const signedURL = 'https://signed.url/123456789'
const edgeToken = 'some other token'
const edgeURL = 'https://edge.netlify'

describe('get', () => {
  describe('With API credentials', () => {
    test('Reads from the blob store', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${complexKey}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      const string = await blobs.get(key)
      expect(string).toBe(value)

      const stream = await blobs.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      const string2 = await blobs.get(complexKey)
      expect(string2).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns `null` when the pre-signed URL returns a 404', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response('Something went wrong', { status: 404 }),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(await blobs.get(key)).toBeNull()
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the API returns a non-200 status code', async () => {
      const mockRequestID = '123456789'
      const mockStore = new MockFetch().get({
        headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
        response: new Response(null, { headers: { [NF_REQUEST_ID]: mockRequestID }, status: 401 }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(async () => await blobs.get(key)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code, ID: ${mockRequestID})`,
      )
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when a pre-signed URL returns a non-200 status code', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response('Something went wrong', { status: 401 }),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await expect(async () => await blobs.get(key)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code)`,
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Reads from a store with a legacy namespace', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/oldie/${key}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/oldie/${key}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { accept: 'application/json;type=signed-url', authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/oldie/${complexKey}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'netlify-internal/legacy-namespace/oldie',
        token: apiToken,
        siteID,
      })

      const string = await blobs.get(key)
      expect(string).toBe(value)

      const stream = await blobs.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      const string2 = await blobs.get(complexKey)
      expect(string2).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Reads from the blob store', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(value),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(value),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      const string = await blobs.get(key)
      expect(string).toBe(value)

      const stream = await blobs.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns `null` when the edge URL returns a 404', async () => {
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { status: 404 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      expect(await blobs.get(key)).toBeNull()
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when an edge URL returns a non-200 status code', async () => {
      const errorDetails = 'Failed to decode token: Token expired'
      const mockStore = new MockFetch().get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers: { [NF_ERROR]: errorDetails }, status: 401 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await expect(async () => await blobs.get(key)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (${errorDetails})`,
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })

    describe('Loads credentials from the environment', () => {
      test('From the `NETLIFY_BLOBS_CONTEXT` environment variable', async () => {
        const tokens = ['some-token-1', 'another-token-2']
        const mockStore = new MockFetch()
          .get({
            headers: { authorization: `Bearer ${tokens[0]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[0]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[1]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[1]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })

        globalThis.fetch = mockStore.fetch

        for (let index = 0; index <= 1; index++) {
          const context = {
            edgeURL,
            siteID,
            token: tokens[index],
          }

          env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

          const store = getStore('images')

          const string = await store.get(key)
          expect(string).toBe(value)

          const stream = await store.get(key, { type: 'stream' })
          expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)
        }

        expect(mockStore.fulfilled).toBeTruthy()
      })

      test('From the `netlifyBlobsContext` global variable', async () => {
        const tokens = ['some-token-1', 'another-token-2']
        const mockStore = new MockFetch()
          .get({
            headers: { authorization: `Bearer ${tokens[0]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[0]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[1]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })
          .get({
            headers: { authorization: `Bearer ${tokens[1]}` },
            response: new Response(value),
            url: `${edgeURL}/${siteID}/site:images/${key}`,
          })

        globalThis.fetch = mockStore.fetch

        for (let index = 0; index <= 1; index++) {
          const context1 = {
            edgeURL,
            siteID,
            token: 'not-the-right-token',
          }

          env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context1)).toString('base64')

          const context2 = {
            edgeURL,
            siteID,
            token: tokens[index],
          }

          globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(context2)).toString('base64')

          const store = getStore('images')

          const string = await store.get(key)
          expect(string).toBe(value)

          const stream = await store.get(key, { type: 'stream' })
          expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)
        }

        expect(mockStore.fulfilled).toBeTruthy()
      })
    })
  })
})

describe('getMetadata', () => {
  describe('With API credentials', () => {
    test('Reads from the blob store and returns the etag and the metadata object', async () => {
      const mockMetadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const headers = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
      }
      const mockStore = new MockFetch().head({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { headers }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      const entry = await blobs.getMetadata(key)
      expect(entry?.etag).toBe(headers.etag)
      expect(entry?.metadata).toEqual(mockMetadata)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns `null` when the API returns a 404', async () => {
      const mockStore = new MockFetch().head({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { status: 404 }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(await blobs.getMetadata(key)).toBeNull()
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the metadata object cannot be parsed', async () => {
      const headers = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(`{"name": "Netlify", "cool`)}`,
      }
      const mockStore = new MockFetch().head({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { headers }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await expect(async () => await blobs.getMetadata(key)).rejects.toThrowError(
        'An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client.',
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Reads from the blob store and returns the etag and the metadata object', async () => {
      const mockMetadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const headers = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
      }
      const mockStore = new MockFetch().head({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      const entry = await blobs.getMetadata(key)
      expect(entry?.etag).toBe(headers.etag)
      expect(entry?.metadata).toEqual(mockMetadata)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})

describe('getWithMetadata', () => {
  describe('With API credentials', () => {
    test('Reads from the blob store and returns the etag and the metadata object', async () => {
      const mockMetadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const responseHeaders = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
      }
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response(value, { headers: responseHeaders }),
          url: signedURL,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response(value, { headers: responseHeaders }),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      const entry1 = await blobs.getWithMetadata(key)
      expect(entry1?.data).toBe(value)
      expect(entry1?.etag).toBe(responseHeaders.etag)
      expect(entry1?.metadata).toEqual(mockMetadata)

      const entry2 = await blobs.getWithMetadata(key, { type: 'stream' })
      expect(await streamToString(entry2?.data as unknown as NodeJS.ReadableStream)).toBe(value)
      expect(entry2?.etag).toBe(responseHeaders.etag)
      expect(entry2?.metadata).toEqual(mockMetadata)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Returns `null` when the pre-signed URL returns a 404', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response('Something went wrong', { status: 404 }),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(await blobs.getWithMetadata(key)).toBeNull()
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the metadata object cannot be parsed', async () => {
      const responseHeaders = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(`{"name": "Netlify", "cool`)}`,
      }
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          response: new Response(value, { headers: responseHeaders }),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await expect(async () => await blobs.getWithMetadata(key)).rejects.toThrowError(
        'An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client.',
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Supports conditional requests', async () => {
      const mockMetadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const etags = {
        right: '"therightetag"',
        wrong: '"thewrongetag"',
      }
      const metadataHeaders = {
        'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
      }
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: `${signedURL}b` })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          headers: { 'if-none-match': etags.wrong },
          response: new Response(value, { headers: { ...metadataHeaders, etag: etags.right }, status: 200 }),
          url: `${signedURL}b`,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: `${signedURL}a` })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .get({
          headers: { 'if-none-match': etags.right },
          response: new Response(null, { headers: { ...metadataHeaders, etag: etags.right }, status: 304 }),
          url: `${signedURL}a`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      const staleEntry = await blobs.getWithMetadata(key, { etag: etags.wrong })
      expect(staleEntry?.data).toBe(value)
      expect(staleEntry?.etag).toBe(etags.right)
      expect(staleEntry?.metadata).toEqual(mockMetadata)

      const freshEntry = await blobs.getWithMetadata(key, { etag: etags.right, type: 'text' })
      expect(freshEntry?.data).toBe(null)
      expect(freshEntry?.etag).toBe(etags.right)
      expect(freshEntry?.metadata).toEqual(mockMetadata)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Reads from the blob store and returns the etag and the metadata object', async () => {
      const mockMetadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const responseHeaders = {
        etag: '123456789',
        'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
      }
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(value, { headers: responseHeaders }),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${edgeToken}` },
          response: new Response(value, { headers: responseHeaders }),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      const entry1 = await blobs.getWithMetadata(key)
      expect(entry1?.data).toBe(value)
      expect(entry1?.etag).toBe(responseHeaders.etag)
      expect(entry1?.metadata).toEqual(mockMetadata)

      const entry2 = await blobs.getWithMetadata(key, { type: 'stream' })
      expect(await streamToString(entry2?.data as unknown as NodeJS.ReadableStream)).toBe(value)
      expect(entry2?.etag).toBe(responseHeaders.etag)
      expect(entry2?.metadata).toEqual(mockMetadata)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})

describe('set', () => {
  describe('With API credentials', () => {
    test('Writes to the blob store', async () => {
      const mockStore = new MockFetch()
        .put({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: { 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null),
          url: signedURL,
        })
        .put({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${complexKey}`,
        })
        .put({
          body: value,
          headers: { 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.set(key, value)
      await blobs.set(complexKey, value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `metadata` parameter', async () => {
      const metadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const encodedMetadata = `b64;${Buffer.from(JSON.stringify(metadata)).toString('base64')}`
      const mockStore = new MockFetch()
        .put({
          headers: { authorization: `Bearer ${apiToken}`, 'netlify-blobs-metadata': encodedMetadata },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
            'x-amz-meta-user': encodedMetadata,
          },
          response: new Response(null),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.set(key, value, { metadata })

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the API returns a non-200 status code', async () => {
      const mockStore = new MockFetch().put({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { status: 401 }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(async () => await blobs.set(key, 'value')).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code)`,
      )
      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the key fails validation', async () => {
      const mockStore = new MockFetch()

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      expect(async () => await blobs.set('', 'value')).rejects.toThrowError('Blob key must not be empty.')
      expect(async () => await blobs.set('/key', 'value')).rejects.toThrowError(
        'Blob key must not start with forward slash (/).',
      )
      expect(async () => await blobs.set('a'.repeat(801), 'value')).rejects.toThrowError(
        'Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long.',
      )
    })

    test('Retries failed operations', async () => {
      const mockStore = new MockFetch()
        .put({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
          },
          response: new Response(null, { status: 500 }),
          url: signedURL,
        })
        .put({
          body: value,
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
          },
          response: new Error('Some network problem'),
          url: signedURL,
        })
        .put({
          body: value,
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
          },
          response: new Response(null, { headers: { 'X-RateLimit-Reset': '10' }, status: 429 }),
          url: signedURL,
        })
        .put({
          body: value,
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
          },
          response: new Response(null),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.set(key, value)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Writes to the blob store', async () => {
      const mockStore = new MockFetch()
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null),
          url: `${edgeURL}/${siteID}/site:production/${complexKey}`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.set(key, value)
      await blobs.set(complexKey, value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the edge URL returns a non-200 status code', async () => {
      const mockStore = new MockFetch().put({
        body: value,
        headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
        response: new Response(null, { status: 401 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await expect(async () => await blobs.set(key, value)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code)`,
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Retries failed operations', async () => {
      const mockStore = new MockFetch()
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null, { status: 500 }),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Error('Some network problem'),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null, { headers: { 'X-RateLimit-Reset': '10' }, status: 429 }),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })
        .put({
          body: value,
          headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
          response: new Response(null),
          url: `${edgeURL}/${siteID}/site:production/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.set(key, value)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})

describe('setJSON', () => {
  describe('With API credentials', () => {
    test('Writes to the blob store', async () => {
      const mockStore = new MockFetch()
        .put({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .put({
          body: JSON.stringify({ value }),
          headers: {
            'cache-control': 'max-age=0, stale-while-revalidate=60',
          },
          response: new Response(null),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.setJSON(key, { value })

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Writes to the blob store', async () => {
      const mockStore = new MockFetch().put({
        body: JSON.stringify({ value }),
        headers: { authorization: `Bearer ${edgeToken}`, 'cache-control': 'max-age=0, stale-while-revalidate=60' },
        response: new Response(null),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.setJSON(key, { value })

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Accepts a `metadata` parameter', async () => {
      const metadata = {
        name: 'Netlify',
        cool: true,
        functions: ['edge', 'serverless'],
      }
      const encodedMetadata = `b64;${Buffer.from(JSON.stringify(metadata)).toString('base64')}`
      const mockStore = new MockFetch().put({
        body: JSON.stringify({ value }),
        headers: {
          authorization: `Bearer ${edgeToken}`,
          'cache-control': 'max-age=0, stale-while-revalidate=60',
          'x-amz-meta-user': encodedMetadata,
        },
        response: new Response(null),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.setJSON(key, { value }, { metadata })

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the `metadata` parameter is above the size limit', async () => {
      const metadata = {
        name: 'Netlify'.repeat(1000),
      }
      const mockStore = new MockFetch()

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      expect(async () => await blobs.setJSON(key, { value }, { metadata })).rejects.toThrowError(
        'Metadata object exceeds the maximum size',
      )
    })
  })
})

describe('delete', () => {
  describe('With API credentials', () => {
    test('Deletes from the blob store', async () => {
      const mockStore = new MockFetch()
        .delete({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(null, { status: 204 }),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
        })
        .delete({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(null, { status: 204 }),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${complexKey}`,
        })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.delete(key)
      await blobs.delete(complexKey)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Does not throw when the blob does not exist', async () => {
      const mockStore = new MockFetch().delete({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { status: 404 }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await blobs.delete(key)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the API returns a non-200 status code', async () => {
      const mockStore = new MockFetch().delete({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(null, { status: 401 }),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        name: 'production',
        token: apiToken,
        siteID,
      })

      await expect(async () => await blobs.delete(key)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code)`,
      )
      expect(mockStore.fulfilled).toBeTruthy()
    })
  })

  describe('With edge credentials', () => {
    test('Deletes from the blob store', async () => {
      const mockStore = new MockFetch().delete({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { status: 204 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.delete(key)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Does not throw when the blob does not exist', async () => {
      const mockStore = new MockFetch().delete({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { status: 404 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await blobs.delete(key)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws when the edge URL returns a non-200 status code', async () => {
      const mockStore = new MockFetch().delete({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { status: 401 }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

      globalThis.fetch = mockStore.fetch

      const blobs = getStore({
        edgeURL,
        name: 'production',
        token: edgeToken,
        siteID,
      })

      await expect(async () => await blobs.delete(key)).rejects.toThrowError(
        `Netlify Blobs has generated an internal error (401 status code)`,
      )

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})

describe('Deploy scope', () => {
  test('Returns a deploy-scoped store if the `deployID` parameter is supplied and the environment context is present', async () => {
    const mockToken = 'some-token'
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/${siteID}/deploy:${deployID}/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/${siteID}/deploy:${deployID}/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const context = {
      edgeURL,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const deployStore = getStore({ deployID })

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Returns a deploy-scoped store if the `deployID` parameter is supplied and the environment context is not present', async () => {
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(JSON.stringify({ url: signedURL })),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}`,
      })
      .get({
        response: new Response(value),
        url: signedURL,
      })
      .get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(JSON.stringify({ url: signedURL })),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}`,
      })
      .get({
        response: new Response(value),
        url: signedURL,
      })

    globalThis.fetch = mockStore.fetch

    const deployStore = getStore({ deployID, siteID, token: apiToken })

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Returns a deploy-scoped store if the `getDeployStore` method is called and the environment context is present', async () => {
    const mockToken = 'some-token'
    const mockRegion = 'us-east-2'
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const context = {
      deployID,
      edgeURL,
      primaryRegion: mockRegion,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const deployStore = getDeployStore()

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Returns a deploy-scoped store if the `getDeployStore` method is called and the environment context is not present', async () => {
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(JSON.stringify({ url: signedURL })),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=auto`,
      })
      .get({
        response: new Response(value),
        url: signedURL,
      })
      .get({
        headers: { authorization: `Bearer ${apiToken}` },
        response: new Response(JSON.stringify({ url: signedURL })),
        url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=auto`,
      })
      .get({
        response: new Response(value),
        url: signedURL,
      })

    globalThis.fetch = mockStore.fetch

    const deployStore = getDeployStore({ deployID, siteID, token: apiToken })

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Returns a named deploy-scoped store if `getDeployStore` receives a string parameter', async () => {
    const mockRegion = 'us-east-1'
    const mockToken = 'some-token'
    const mockStoreName = 'my-store'
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}:${mockStoreName}/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}:${mockStoreName}/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const context = {
      deployID,
      edgeURL,
      primaryRegion: mockRegion,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const deployStore = getDeployStore(mockStoreName)

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Returns a named deploy-scoped store if `getDeployStore` receives an object with a `name` property', async () => {
    const mockRegion = 'us-east-1'
    const mockToken = 'some-token'
    const mockStoreName = 'my-store'
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}:${mockStoreName}/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${mockToken}` },
        response: new Response(value),
        url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}:${mockStoreName}/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const context = {
      deployID,
      edgeURL,
      primaryRegion: mockRegion,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const deployStore = getDeployStore({ name: mockStoreName })

    const string = await deployStore.get(key)
    expect(string).toBe(value)

    const stream = await deployStore.get(key, { type: 'stream' })
    expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Throws if the deploy ID fails validation', async () => {
    const mockRegion = 'us-east-2'
    const mockToken = 'some-token'
    const mockStore = new MockFetch()
    const longDeployID = 'd'.repeat(80)

    globalThis.fetch = mockStore.fetch

    expect(() => getDeployStore({ deployID: 'deploy/ID', siteID, region: mockRegion, token: apiToken })).toThrowError(
      `'deploy/ID' is not a valid Netlify deploy ID`,
    )
    expect(() => getStore({ deployID: 'deploy/ID', siteID, token: apiToken })).toThrowError(
      `'deploy/ID' is not a valid Netlify deploy ID`,
    )
    expect(() => getStore({ deployID: longDeployID, siteID, token: apiToken })).toThrowError(
      `'${longDeployID}' is not a valid Netlify deploy ID`,
    )

    const context = {
      deployID: 'uhoh!',
      edgeURL,
      primaryRegion: mockRegion,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    expect(() => getDeployStore()).toThrowError(`'uhoh!' is not a valid Netlify deploy ID`)
  })
})

describe('Custom `fetch`', () => {
  test('Uses a custom implementation of `fetch` if the `fetch` parameter is supplied', async () => {
    globalThis.fetch = () => {
      throw new Error('I should not be called')
    }

    const mockToken = 'some-token'
    const mockStore = new MockFetch().get({
      headers: { authorization: `Bearer ${mockToken}` },
      response: new Response(value),
      url: `${edgeURL}/${siteID}/site:images/${key}`,
    })
    const context = {
      edgeURL,
      siteID,
      token: mockToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const store = getStore({ fetch: mockStore.fetch, name: 'images' })

    const string = await store.get(key)
    expect(string).toBe(value)

    expect(mockStore.fulfilled).toBeTruthy()
  })
})

describe(`getStore`, () => {
  test('Throws when the instance is missing required configuration properties', async () => {
    const { fetch } = new MockFetch()

    globalThis.fetch = fetch

    expect(() => getStore('production')).toThrowError(MissingBlobsEnvironmentError)
    expect(() =>
      getStore({
        name: 'production',
        token: apiToken,
        siteID: '',
      }),
    ).toThrowError(MissingBlobsEnvironmentError)
  })

  test('Throws when the name of the store is not provided', async () => {
    const { fetch } = new MockFetch()

    globalThis.fetch = fetch

    // @ts-expect-error Ignoring types, which expect an argument
    expect(() => getStore()).toThrowError(
      'The `getStore` method requires the name of the store as a string or as the `name` property of an options object',
    )

    expect(() =>
      getStore({
        token: apiToken,
        siteID,
      }),
    ).toThrowError(
      'The `getStore` method requires the name of the store as a string or as the `name` property of an options object',
    )
  })

  test('Throws when the name of the store fails validation', async () => {
    const { fetch } = new MockFetch()

    globalThis.fetch = fetch

    expect(() =>
      getStore({
        name: 'some/store',
        token: apiToken,
        siteID,
      }),
    ).toThrowError(`Store name must not contain forward slashes (/).`)

    expect(() =>
      getStore({
        name: 'a'.repeat(70),
        token: apiToken,
        siteID,
      }),
    ).toThrowError(`Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long.`)

    const context = {
      siteID,
      token: apiToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    expect(() => getStore('some/store')).toThrowError('Store name must not contain forward slashes (/).')
  })

  test('Throws when there is no `fetch` implementation available', async () => {
    // @ts-expect-error Assigning a value that doesn't match the type.
    globalThis.fetch = undefined

    const context = {
      siteID,
      token: apiToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    expect(() => getStore('production')).toThrowError(
      'Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property.',
    )
  })
})

describe('Region configuration in deploy-scoped stores', () => {
  describe('Without a `region` option', () => {
    test('The client sends a `region=auto` parameter to API calls', async () => {
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=auto`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=auto`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore({ deployID, siteID, token: apiToken })

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('The client sends the region configured in the context to edge calls', async () => {
      const mockRegion = 'us-east-2'
      const mockToken = 'some-token'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })

      const context = {
        edgeURL,
        deployID,
        siteID,
        primaryRegion: mockRegion,
        token: mockToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore()

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('Throws an error if using the edge URL and no region is configured in the context', async () => {
      const mockRegion = 'us-east-2'
      const mockToken = 'some-token'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      expect(() => getDeployStore({ deployID, edgeURL, siteID, token: mockToken })).toThrowError()
      expect(mockStore.fulfilled).toBeFalsy()
    })
  })

  describe('With a `region` option', () => {
    test('The client sends that region to API calls', async () => {
      const mockRegion = 'us-east-1'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      const context = {
        deployID,
        siteID,
        token: apiToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore({ region: mockRegion })

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('The client sends that region to API calls, even if a different region is present in the context', async () => {
      const mockRegion = 'us-east-1'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      const context = {
        deployID,
        siteID,
        primaryRegion: 'us-east-2',
        token: apiToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore({ region: mockRegion })

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('The client throws an error if the region supplied is not supported', async () => {
      const mockRegion = 'us-east-1'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })
        .get({
          headers: { authorization: `Bearer ${apiToken}` },
          response: new Response(JSON.stringify({ url: signedURL })),
          url: `https://api.netlify.com/api/v1/blobs/${siteID}/deploy:${deployID}/${key}?region=${mockRegion}`,
        })
        .get({
          response: new Response(value),
          url: signedURL,
        })

      const context = {
        deployID,
        siteID,
        primaryRegion: 'us-east-2',
        token: apiToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      // @ts-expect-error Knowingly supplying an invalid value to `region`.
      expect(() => getDeployStore({ deployID, edgeURL, siteID, region: 'eu-west-1' })).toThrowError()
      expect(mockStore.fulfilled).toBeFalsy()
    })

    test('The client sends that region to edge calls', async () => {
      const mockRegion = 'us-east-2'
      const mockToken = 'some-token'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      const context = {
        deployID,
        edgeURL,
        siteID,
        token: mockToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore({ region: mockRegion })

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })

    test('The client sends that region to edge calls, even if a different region is set in the context', async () => {
      const mockRegion = 'us-east-2'
      const mockToken = 'some-token'
      const mockStore = new MockFetch()
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })
        .get({
          headers: { authorization: `Bearer ${mockToken}` },
          response: new Response(value),
          url: `${edgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
        })

      globalThis.fetch = mockStore.fetch

      const context = {
        deployID,
        edgeURL,
        primaryRegion: 'us-east-1',
        siteID,
        token: mockToken,
      }

      env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

      globalThis.fetch = mockStore.fetch

      const deployStore = getDeployStore({ region: mockRegion })

      const string = await deployStore.get(key)
      expect(string).toBe(value)

      const stream = await deployStore.get(key, { type: 'stream' })
      expect(await streamToString(stream as unknown as NodeJS.ReadableStream)).toBe(value)

      expect(mockStore.fulfilled).toBeTruthy()
    })
  })
})

describe('setEnvironmentContext', () => {
  test('Injects the context object into the environment', () => {
    expect(env.NETLIFY_BLOBS_CONTEXT).toBeUndefined()

    setEnvironmentContext({
      deployID,
      primaryRegion: 'us-east-1',
      siteID,
      token: apiToken,
    })

    expect(env.NETLIFY_BLOBS_CONTEXT).toBeTypeOf('string')

    const context = JSON.parse(base64Decode(env.NETLIFY_BLOBS_CONTEXT as string))

    expect(context.deployID).toBe(deployID)
    expect(context.primaryRegion).toBe('us-east-1')
    expect(context.siteID).toBe(siteID)
    expect(context.token).toBe(apiToken)
  })
})
