import { Buffer } from 'node:buffer'
import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import { describe, test, expect, beforeAll, afterEach } from 'vitest'

import { MockFetch } from '../test/mock_fetch.js'
import { base64Encode } from '../test/util.js'

import { getDeployStore, getStore } from './main.js'

const deployID = '6527dfab35be400008332a1d'
const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const key = '54321'
const value = 'some value'
const edgeToken = 'some other token'
const edgeURL = 'https://edge.netlify'
const uncachedEdgeURL = 'https://uncached.edge.netlify'

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

describe('Consistency configuration', () => {
  test('Respects the consistency mode supplied in the operation methods', async () => {
    const mockMetadata = {
      name: 'Netlify',
      cool: true,
      functions: ['edge', 'serverless'],
    }
    const headers = {
      etag: '123456789',
      'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
    }
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })
      .head({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers }),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value, { headers }),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const context = {
      edgeURL,
      siteID,
      token: edgeToken,
      uncachedEdgeURL,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const blobs = getStore('production')

    const data = await blobs.get(key, { consistency: 'strong' })
    expect(data).toBe(value)

    const meta = await blobs.getMetadata(key, { consistency: 'strong' })
    expect(meta?.etag).toBe(headers.etag)
    expect(meta?.metadata).toEqual(mockMetadata)

    const dataWithMeta = await blobs.getWithMetadata(key, { consistency: 'strong' })
    expect(dataWithMeta?.data).toBe(value)
    expect(dataWithMeta?.etag).toBe(headers.etag)
    expect(dataWithMeta?.metadata).toEqual(mockMetadata)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Respects the consistency mode supplied in the `getStore()` constructor', async () => {
    const mockMetadata = {
      name: 'Netlify',
      cool: true,
      functions: ['edge', 'serverless'],
    }
    const headers = {
      etag: '123456789',
      'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
    }
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })
      .head({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers }),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value, { headers }),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const blobs = getStore({
      consistency: 'strong',
      edgeURL,
      name: 'production',
      token: edgeToken,
      siteID,
      uncachedEdgeURL,
    })

    const data = await blobs.get(key)
    expect(data).toBe(value)

    const meta = await blobs.getMetadata(key)
    expect(meta?.etag).toBe(headers.etag)
    expect(meta?.metadata).toEqual(mockMetadata)

    const dataWithMeta = await blobs.getWithMetadata(key)
    expect(dataWithMeta?.data).toBe(value)
    expect(dataWithMeta?.etag).toBe(headers.etag)
    expect(dataWithMeta?.metadata).toEqual(mockMetadata)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Respects the consistency mode supplied in the `getDeployStore()` constructor', async () => {
    const mockMetadata = {
      name: 'Netlify',
      cool: true,
      functions: ['edge', 'serverless'],
    }
    const mockRegion = 'us-east-1'
    const headers = {
      etag: '123456789',
      'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
    }
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value),
        url: `${uncachedEdgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
      })
      .head({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers }),
        url: `${uncachedEdgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value, { headers }),
        url: `${uncachedEdgeURL}/region:${mockRegion}/${siteID}/deploy:${deployID}/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const blobs = getDeployStore({
      consistency: 'strong',
      edgeURL,
      deployID,
      region: mockRegion,
      token: edgeToken,
      siteID,
      uncachedEdgeURL,
    })

    const data = await blobs.get(key)
    expect(data).toBe(value)

    const meta = await blobs.getMetadata(key)
    expect(meta?.etag).toBe(headers.etag)
    expect(meta?.metadata).toEqual(mockMetadata)

    const dataWithMeta = await blobs.getWithMetadata(key)
    expect(dataWithMeta?.data).toBe(value)
    expect(dataWithMeta?.etag).toBe(headers.etag)
    expect(dataWithMeta?.metadata).toEqual(mockMetadata)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('The consistency mode from the operation methods takes precedence over the store configuration', async () => {
    const mockMetadata = {
      name: 'Netlify',
      cool: true,
      functions: ['edge', 'serverless'],
    }
    const headers = {
      etag: '123456789',
      'x-amz-meta-user': `b64;${base64Encode(mockMetadata)}`,
    }
    const mockStore = new MockFetch()
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value),
        url: `${uncachedEdgeURL}/${siteID}/site:production/${key}`,
      })
      .head({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(null, { headers }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })
      .get({
        headers: { authorization: `Bearer ${edgeToken}` },
        response: new Response(value, { headers }),
        url: `${edgeURL}/${siteID}/site:production/${key}`,
      })

    globalThis.fetch = mockStore.fetch

    const blobs = getStore({
      consistency: 'strong',
      edgeURL,
      name: 'production',
      token: edgeToken,
      siteID,
      uncachedEdgeURL,
    })

    const data = await blobs.get(key)
    expect(data).toBe(value)

    const meta = await blobs.getMetadata(key, { consistency: 'eventual' })
    expect(meta?.etag).toBe(headers.etag)
    expect(meta?.metadata).toEqual(mockMetadata)

    const dataWithMeta = await blobs.getWithMetadata(key, { consistency: 'eventual' })
    expect(dataWithMeta?.data).toBe(value)
    expect(dataWithMeta?.etag).toBe(headers.etag)
    expect(dataWithMeta?.metadata).toEqual(mockMetadata)

    expect(mockStore.fulfilled).toBeTruthy()
  })

  test('Throws when strong consistency is used and no `uncachedEdgeURL` property has been defined', async () => {
    const context = {
      edgeURL,
      siteID,
      token: edgeToken,
    }

    env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

    const store = getStore('productin')

    await expect(async () => await store.get('my-key', { consistency: 'strong' })).rejects.toThrowError(
      "Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property",
    )
  })
})
