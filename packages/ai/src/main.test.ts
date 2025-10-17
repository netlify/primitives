import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAIGatewayToken, setupAIGateway, parseAIGatewayContext, fetchAIProviders } from './bootstrap/main.js'
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

  test('successfully fetches AI Gateway token with prior authorization', async () => {
    const mockResponse = {
      token: 'new-ai-gateway-token',
      url: 'https://ai-gateway.com/.netlify/ai/',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await fetchAIGatewayToken({
      api: mockApi,
      siteId: 'test-site-id',
      priorAuthToken: 'prior-token',
    })

    expect(result).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site-id/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
        'X-Prior-Authorization': 'prior-token',
      },
    })
  })

  test('returns null when no access token is provided', async () => {
    const apiWithoutToken: NetlifyAPI = {
      scheme: mockApi.scheme,
      host: mockApi.host,
      accessToken: undefined,
    } as NetlifyAPI

    const result = await fetchAIGatewayToken({
      api: apiWithoutToken,
      siteId: 'test-site-id',
    })

    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
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

describe('fetchAIProviders', () => {
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
  } as NetlifyAPI

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

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProvidersResponse),
    })

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([
      { key: 'ANTHROPIC_API_KEY', url: 'ANTHROPIC_BASE_URL' },
      { key: 'OPENAI_API_KEY', url: 'OPENAI_BASE_URL' },
      { key: 'GEMINI_API_KEY', url: 'GOOGLE_GEMINI_BASE_URL' },
    ])
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/ai-gateway/providers', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })
  })

  test('returns empty array when no access token is provided', async () => {
    const apiWithoutToken: NetlifyAPI = {
      scheme: mockApi.scheme,
      host: mockApi.host,
      accessToken: undefined,
    } as NetlifyAPI

    const result = await fetchAIProviders({ api: apiWithoutToken })

    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('returns empty array when API returns 404', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('returns empty array for other HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('handles invalid response format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' }),
    })

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })

  test('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchAIProviders({ api: mockApi })

    expect(result).toEqual([])
  })
})

describe('setupAIGateway', () => {
  const mockApi: NetlifyAPI = {
    scheme: 'https',
    host: 'api.netlify.com',
    accessToken: 'test-token',
  } as NetlifyAPI

  const originalProcessEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset process.env to original state
    process.env = { ...originalProcessEnv }
  })

  afterEach(() => {
    // Restore original process.env
    process.env = originalProcessEnv
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

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

  test('uses prior authorization token from existing AI_GATEWAY in process.env', async () => {
    const existingContext = {
      token: 'existing-token',
      url: 'https://example.com/.netlify/ai',
      envVars: [],
    }
    const existingBase64 = Buffer.from(JSON.stringify(existingContext)).toString('base64')
    process.env.AI_GATEWAY = existingBase64

    const mockTokenResponse = {
      token: 'new-ai-gateway-token',
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
    }

    await setupAIGateway(config)

    // Verify that the fetchAIGatewayToken was called with the prior auth token
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
        'X-Prior-Authorization': 'existing-token',
      },
    })

    expect(env).toHaveProperty('AI_GATEWAY')
  })

  test('does not use prior authorization when existing AI_GATEWAY has different URL', async () => {
    const existingContext = {
      token: 'existing-token',
      url: 'https://different-site.com/.netlify/ai',
      envVars: [],
    }
    const existingBase64 = Buffer.from(JSON.stringify(existingContext)).toString('base64')
    process.env.AI_GATEWAY = existingBase64

    const mockTokenResponse = {
      token: 'new-ai-gateway-token',
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
    }

    await setupAIGateway(config)

    // Verify that the fetchAIGatewayToken was called without prior auth token
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })

    expect(env).toHaveProperty('AI_GATEWAY')
  })

  test('handles invalid AI_GATEWAY in process.env gracefully', async () => {
    process.env.AI_GATEWAY = 'invalid-base64-data'

    const mockTokenResponse = {
      token: 'new-ai-gateway-token',
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
    }

    await setupAIGateway(config)

    // Verify that the fetchAIGatewayToken was called without prior auth token
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })

    expect(env).toHaveProperty('AI_GATEWAY')
  })

  test('uses existingToken parameter when provided, ignoring process.env', async () => {
    const existingContext = {
      token: 'existing-token-from-env',
      url: 'https://example.com/.netlify/ai',
      envVars: [],
    }
    const existingBase64 = Buffer.from(JSON.stringify(existingContext)).toString('base64')
    process.env.AI_GATEWAY = existingBase64

    const mockTokenResponse = {
      token: 'new-ai-gateway-token',
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
      existingToken: 'explicit-prior-token',
    }

    await setupAIGateway(config)

    // Verify that the fetchAIGatewayToken was called with the explicit existingToken, not the one from env
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
        'X-Prior-Authorization': 'explicit-prior-token',
      },
    })

    expect(env).toHaveProperty('AI_GATEWAY')
  })

  test('uses empty existingToken parameter over process.env when explicitly set to empty string', async () => {
    const existingContext = {
      token: 'existing-token-from-env',
      url: 'https://example.com/.netlify/ai',
      envVars: [],
    }
    const existingBase64 = Buffer.from(JSON.stringify(existingContext)).toString('base64')
    process.env.AI_GATEWAY = existingBase64

    const mockTokenResponse = {
      token: 'new-ai-gateway-token',
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

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProvidersResponse),
      })

    const env = {}
    const config = {
      api: mockApi,
      env,
      siteID: 'test-site',
      siteURL: 'https://example.com',
      existingToken: '',
    }

    await setupAIGateway(config)

    // Verify that the fetchAIGatewayToken was called without prior auth token when existingToken is empty string
    expect(mockFetch).toHaveBeenCalledWith('https://api.netlify.com/api/v1/sites/test-site/ai-gateway/token', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    })

    expect(env).toHaveProperty('AI_GATEWAY')
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
