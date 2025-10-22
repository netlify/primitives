import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchAIGatewayToken, setupAIGateway, parseAIGatewayContext, fetchAIProviders } from './bootstrap/main.js'
import type { NetlifyAPI } from '@netlify/api'

describe('fetchAIGatewayToken', () => {
  const mockGetAIGatewayToken = vi.fn()
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
    getAIGatewayToken: mockGetAIGatewayToken,
  } as unknown as NetlifyAPI

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('successfully fetches AI Gateway token', async () => {
    const mockResponse = {
      token: 'ai-gateway-token',
      url: 'https://ai-gateway.com/.netlify/ai/',
    }

    mockGetAIGatewayToken.mockResolvedValue(mockResponse)

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toEqual(mockResponse)
    expect(mockGetAIGatewayToken).toHaveBeenCalledWith({ site_id: 'test-site-id' })
  })

  test('returns null when no access token is provided', async () => {
    const apiWithoutToken: NetlifyAPI = {
      scheme: mockApi.scheme,
      host: mockApi.host,
      accessToken: undefined,
      getAIGatewayToken: mockGetAIGatewayToken,
    } as unknown as NetlifyAPI

    const result = await fetchAIGatewayToken({
      api: apiWithoutToken,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
    expect(mockGetAIGatewayToken).not.toHaveBeenCalled()
  })

  test('returns null when API returns 404', async () => {
    const error: any = new Error('Not Found')
    error.status = 404
    mockGetAIGatewayToken.mockRejectedValue(error)

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('throws error for non-404 HTTP errors', async () => {
    const error = new Error('Internal Server Error')
    mockGetAIGatewayToken.mockRejectedValue(error)

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('handles invalid response format', async () => {
    mockGetAIGatewayToken.mockResolvedValue({ invalid: 'response' })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })

  test('handles network errors', async () => {
    mockGetAIGatewayToken.mockRejectedValue(new Error('Network error'))

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
  })
})

describe('fetchAIProviders', () => {
  const mockGetAIGatewayProviders = vi.fn()
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
    getAIGatewayProviders: mockGetAIGatewayProviders,
  } as unknown as NetlifyAPI

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('successfully fetches AI providers and transforms to env vars', async () => {
    const mockProvidersResponse = {
      providers: {
        anthropic: {
          token_env_var: 'ANTHROPIC_API_KEY',
          url_env_var: 'ANTHROPIC_BASE_URL',
          models: ['claude-3-haiku-20240307'],
        },
        openai: {
          token_env_var: 'OPENAI_API_KEY',
          url_env_var: 'OPENAI_BASE_URL',
          models: ['gpt-4'],
        },
        gemini: {
          token_env_var: 'GEMINI_API_KEY',
          url_env_var: 'GOOGLE_GEMINI_BASE_URL',
          models: ['gemini-pro'],
        },
      },
    }

    mockGetAIGatewayProviders.mockResolvedValue(mockProvidersResponse)

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([
      { key: 'ANTHROPIC_API_KEY', url: 'ANTHROPIC_BASE_URL' },
      { key: 'OPENAI_API_KEY', url: 'OPENAI_BASE_URL' },
      { key: 'GEMINI_API_KEY', url: 'GOOGLE_GEMINI_BASE_URL' },
    ])
    expect(mockGetAIGatewayProviders).toHaveBeenCalled()
  })

  test('returns empty array when no access token is provided', async () => {
    const apiWithoutToken: NetlifyAPI = {
      scheme: mockApi.scheme,
      host: mockApi.host,
      accessToken: undefined,
      getAIGatewayProviders: mockGetAIGatewayProviders,
    } as unknown as NetlifyAPI

    const result = await fetchAIProviders({ api: apiWithoutToken })

    expect(result).toEqual([])
    expect(mockGetAIGatewayProviders).not.toHaveBeenCalled()
  })

  test('returns empty array when API returns 404', async () => {
    const error: any = new Error('Not Found')
    error.status = 404
    mockGetAIGatewayProviders.mockRejectedValue(error)

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('returns empty array for other HTTP errors', async () => {
    const error = new Error('Internal Server Error')
    mockGetAIGatewayProviders.mockRejectedValue(error)

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('handles invalid response format', async () => {
    mockGetAIGatewayProviders.mockResolvedValue({ invalid: 'response' })

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('handles network errors', async () => {
    mockGetAIGatewayProviders.mockRejectedValue(new Error('Network error'))

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })
})

describe('setupAIGateway', () => {
  const mockGetAIGatewayToken = vi.fn()
  const mockGetAIGatewayProviders = vi.fn()
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
    getAIGatewayToken: mockGetAIGatewayToken,
    getAIGatewayProviders: mockGetAIGatewayProviders,
  } as unknown as NetlifyAPI

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('sets up AI Gateway when conditions are met', async () => {
    const mockTokenResponse = {
      token: 'ai-gateway-token',
      url: 'https://ai-gateway.com/.netlify/ai',
    }

    const mockProvidersResponse = {
      providers: {
        openai: {
          token_env_var: 'OPENAI_API_KEY',
          url_env_var: 'OPENAI_BASE_URL',
          models: ['gpt-4'],
        },
      },
    }

    mockGetAIGatewayToken.mockResolvedValue(mockTokenResponse)
    mockGetAIGatewayProviders.mockResolvedValue(mockProvidersResponse)

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
    }

    await setupAIGateway(config)

    expect(env).toHaveProperty('AI_GATEWAY')
    expect((env as { AI_GATEWAY: { sources: string[] } }).AI_GATEWAY.sources).toEqual(['internal'])

    const base64Value = (env as { AI_GATEWAY: { value: string } }).AI_GATEWAY.value
    const decodedContext = JSON.parse(Buffer.from(base64Value, 'base64').toString('utf8'))
    expect(decodedContext).toEqual({
      token: 'ai-gateway-token',
      url: 'https://example.com/.netlify/ai',
      envVars: [{ key: 'OPENAI_API_KEY', url: 'OPENAI_BASE_URL' }],
    })
  })

  test('skips setup when site is unlinked', async () => {
    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'unlinked',
      siteURL: 'https://example.com',
    }

    await setupAIGateway(config)

    expect(env).not.toHaveProperty('AI_GATEWAY')
  })

  test('skips setup when no siteURL', async () => {
    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: undefined,
    }

    await setupAIGateway(config)

    expect(env).not.toHaveProperty('AI_GATEWAY')
  })
})

describe('parseAIGatewayContext', () => {
  test('parses valid AI Gateway context', () => {
    const contextData = { token: 'test-token', url: 'https://example.com/.netlify/ai' }
    const base64Data = Buffer.from(JSON.stringify(contextData)).toString('base64')

    const result = parseAIGatewayContext(base64Data)

    expect(result).toEqual(contextData)
  })

  test('parses AI Gateway context with envVars', () => {
    const contextData = {
      token: 'test-token',
      url: 'https://example.com/.netlify/ai',
      envVars: [
        { key: 'OPENAI_API_KEY', url: 'OPENAI_BASE_URL' },
        { key: 'ANTHROPIC_API_KEY', url: 'ANTHROPIC_BASE_URL' },
      ],
    }
    const base64Data = Buffer.from(JSON.stringify(contextData)).toString('base64')

    const result = parseAIGatewayContext(base64Data)

    expect(result).toEqual(contextData)
  })

  test('returns undefined when no value provided', () => {
    const result = parseAIGatewayContext()

    expect(result).toBeUndefined()
  })

  test('returns undefined when value is invalid base64', () => {
    const result = parseAIGatewayContext('invalid-base64')

    expect(result).toBeUndefined()
  })

  test('returns undefined when value contains invalid JSON', () => {
    const invalidBase64 = Buffer.from('invalid-json').toString('base64')

    const result = parseAIGatewayContext(invalidBase64)

    expect(result).toBeUndefined()
  })
})
