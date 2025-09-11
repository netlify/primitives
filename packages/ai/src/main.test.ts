import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchAIGatewayToken, setupAIGateway, parseAIGatewayContext } from './bootstrap/main.js'
import type { NetlifyAPI } from '@netlify/api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('fetchAIGatewayToken', () => {
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
  } as NetlifyAPI

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('successfully fetches AI Gateway token', async () => {
    const mockResponse = {
      token: 'ai-gateway-token',
      url: 'https://ai-gateway.com/.netlify/ai/',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site-id/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })
  })

  test('returns null when API returns 404', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('throws error for non-404 HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('handles invalid response format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' }),
    })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })
})

describe('setupAIGateway', () => {
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
  } as NetlifyAPI

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AI_GATEWAY
  })

  test('sets up AI Gateway when conditions are met', async () => {
    const mockResponse = {
      token: 'ai-gateway-token',
      url: 'https://ai-gateway.com/.netlify/ai',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const env = {}
    const config = {
      api: mockApi,
      env,
      options: {},
      site: { id: 'test-site' },
      siteUrl: 'https://example.com',
    }

    await setupAIGateway(config)

    expect(env).toHaveProperty('AI_GATEWAY')
    expect((env as { AI_GATEWAY: { sources: string[] } }).AI_GATEWAY.sources).toEqual(['internal'])
    expect(process.env.AI_GATEWAY).toBeDefined()
  })

  test('skips setup when site is unlinked', async () => {
    const env = {}
    const config = {
      api: mockApi,
      env,
      options: {},
      site: { id: 'unlinked' },
      siteUrl: 'https://example.com',
    }

    await setupAIGateway(config)

    expect(env).not.toHaveProperty('AI_GATEWAY')
    expect(process.env.AI_GATEWAY).toBeUndefined()
  })

  test('skips setup when offline', async () => {
    const env = {}
    const config = {
      api: mockApi,
      env,
      options: { offline: true },
      site: { id: 'test-site' },
      siteUrl: 'https://example.com',
    }

    await setupAIGateway(config)

    expect(env).not.toHaveProperty('AI_GATEWAY')
    expect(process.env.AI_GATEWAY).toBeUndefined()
  })

  test('skips setup when no siteUrl', async () => {
    const env = {}
    const config = {
      api: mockApi,
      env,
      options: {},
      site: { id: 'test-site' },
      siteUrl: undefined,
    }

    await setupAIGateway(config)

    expect(env).not.toHaveProperty('AI_GATEWAY')
    expect(process.env.AI_GATEWAY).toBeUndefined()
  })
})

describe('parseAIGatewayContext', () => {
  beforeEach(() => {
    delete process.env.AI_GATEWAY
  })

  test('parses valid AI Gateway context', () => {
    const contextData = { token: 'test-token', url: 'https://example.com/.netlify/ai' }
    const base64Data = Buffer.from(JSON.stringify(contextData)).toString('base64')
    process.env.AI_GATEWAY = base64Data

    const result = parseAIGatewayContext()

    expect(result).toEqual(contextData)
  })

  test('returns undefined when no AI_GATEWAY env var', () => {
    const result = parseAIGatewayContext()

    expect(result).toBeUndefined()
  })

  test('returns undefined when AI_GATEWAY is invalid base64', () => {
    process.env.AI_GATEWAY = 'invalid-base64'

    const result = parseAIGatewayContext()

    expect(result).toBeUndefined()
  })

  test('returns undefined when AI_GATEWAY contains invalid JSON', () => {
    process.env.AI_GATEWAY = Buffer.from('invalid-json').toString('base64')

    const result = parseAIGatewayContext()

    expect(result).toBeUndefined()
  })
})
