import process from 'node:process'

import { MockFetch } from '@netlify/test-utils'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { purgeCache } from './purge-cache.js'

const token = '1q2w3e4r5t6y7u8i9o0p'
const purgeURL = 'https://api.netlify.com/api/v1/purge'
const globalScope = globalThis as { Netlify?: unknown }
const globalNetlify = globalScope.Netlify

// Sets the `Netlify` global the way the runtime does while handling a request.
const setRequestSite = (siteID: string) => {
  globalScope.Netlify = { context: { site: { id: siteID } } }
}

const expectPurge = (expected: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new MockFetch()
    .post({
      body: (payload: string | null) => {
        expect(JSON.parse(payload ?? '')).toMatchObject(expected)
      },
      headers: { Authorization: `Bearer ${token}`, ...headers },
      response: new Response(null, { status: 202 }),
      url: purgeURL,
    })
    .inject()

beforeEach(() => {
  delete process.env.NETLIFY_PURGE_API_TOKEN
  delete process.env.SITE_ID
  delete process.env.NETLIFY_LOCAL
})

afterEach(() => {
  globalScope.Netlify = globalNetlify
})

describe('`purgeCache`', () => {
  test('Purges by site using the site ID and token from the environment', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    process.env.SITE_ID = 'site-from-environment'

    const mockFetch = expectPurge({ site_id: 'site-from-environment' })

    try {
      await expect(purgeCache()).resolves.toBeUndefined()
      expect(mockFetch.fulfilled).toBe(true)
    } finally {
      mockFetch.restore()
    }
  })

  test('Reads the site ID from the request when the environment does not have one', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    setRequestSite('site-from-request')

    const mockFetch = expectPurge({ site_id: 'site-from-request', cache_tags: ['tag-1'] })

    try {
      await purgeCache({ tags: ['tag-1'] })
      expect(mockFetch.fulfilled).toBe(true)
    } finally {
      mockFetch.restore()
    }
  })

  test('Prefers the site ID from the request over the one from the environment', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    process.env.SITE_ID = 'site-from-environment'
    setRequestSite('site-from-request')

    const mockFetch = expectPurge({ site_id: 'site-from-request' })

    try {
      await purgeCache()
      expect(mockFetch.fulfilled).toBe(true)
    } finally {
      mockFetch.restore()
    }
  })

  test('Prefers the `siteID` option over the site ID from the request', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    setRequestSite('site-from-request')

    const mockFetch = expectPurge({ site_id: 'site-from-options' })

    try {
      await purgeCache({ siteID: 'site-from-options' })
      expect(mockFetch.fulfilled).toBe(true)
    } finally {
      mockFetch.restore()
    }
  })

  test('Purges by site slug or domain without needing a site ID', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token

    const bySlug = expectPurge({ site_slug: 'my-site' })

    try {
      await purgeCache({ siteSlug: 'my-site' })
      expect(bySlug.fulfilled).toBe(true)
    } finally {
      bySlug.restore()
    }

    const byDomain = expectPurge({ domain: 'example.com', deploy_alias: 'staging' })

    try {
      await purgeCache({ domain: 'example.com', deployAlias: 'staging' })
      expect(byDomain.fulfilled).toBe(true)
    } finally {
      byDomain.restore()
    }
  })

  test('Accepts a custom user-agent', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    process.env.SITE_ID = 'site-from-environment'

    const mockFetch = expectPurge({ site_id: 'site-from-environment' }, { 'user-agent': 'Netlify' })

    try {
      await purgeCache({ userAgent: 'Netlify' })
      expect(mockFetch.fulfilled).toBe(true)
    } finally {
      mockFetch.restore()
    }
  })

  test('Throws when neither the request nor the environment has a site ID', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token

    await expect(purgeCache()).rejects.toThrow('The Netlify site ID was not found in the execution environment.')
  })

  test('Throws when there is no token', async () => {
    process.env.SITE_ID = 'site-from-environment'

    await expect(purgeCache()).rejects.toThrow('The cache purge API token was not found in the execution environment.')
  })

  test('Throws if the API response does not have a successful status code', async () => {
    process.env.NETLIFY_PURGE_API_TOKEN = token
    process.env.SITE_ID = 'site-from-environment'

    const mockFetch = new MockFetch().post({ response: new Response(null, { status: 500 }), url: purgeURL }).inject()

    try {
      await expect(purgeCache()).rejects.toThrow('Cache purge API call returned an unexpected status code: 500')
    } finally {
      mockFetch.restore()
    }
  })

  test('Skips the purge in local development when there is no token', async () => {
    process.env.NETLIFY_LOCAL = '1'

    const mockFetch = new MockFetch().inject()

    try {
      await expect(purgeCache({ tags: ['tag-1'] })).resolves.toBeUndefined()
    } finally {
      mockFetch.restore()
    }
  })
})
