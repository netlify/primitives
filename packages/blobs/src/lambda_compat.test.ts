import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import { describe, test, expect, beforeAll, afterEach } from 'vitest'

import { MockFetch } from '../test/mock_fetch.js'
import { base64Encode, streamToString } from '../test/util.js'

import { connectLambda } from './lambda_compat.js'
import { getStore } from './main.js'

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

const deployID = '6527dfab35be400008332a1d'
const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const key = '54321'
const value = 'some value'
const edgeToken = 'some other token'
const edgeURL = 'https://edge.netlify'

describe('With edge credentials', () => {
  test('Loads the credentials set via the `connectLambda` method', async () => {
    const mockLambdaEvent = {
      blobs: base64Encode({ token: edgeToken, url: edgeURL }),
      headers: {
        'x-nf-deploy-id': deployID,
        'x-nf-site-id': siteID,
      },
    }
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

    connectLambda(mockLambdaEvent)

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
})
