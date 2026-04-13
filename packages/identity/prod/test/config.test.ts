import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'

vi.mock('gotrue-js', () => {
  const mockSettings = vi.fn()
  return {
    default: class MockGoTrue {
      settings = mockSettings
    },
    __mockSettings: mockSettings,
  }
})

const getMockSettings = async () => {
  const mod = await import('gotrue-js')
  return (mod as unknown as { __mockSettings: ReturnType<typeof vi.fn> }).__mockSettings
}

describe('getIdentityConfig (server)', () => {
  beforeEach(() => {
    vi.resetModules()
    resetTestGoTrueClient()
  })

  afterEach(() => {
    delete globalThis.netlifyIdentityContext
    delete globalThis.Netlify
    resetTestGoTrueClient()
  })

  it('returns null outside Netlify environment', async () => {
    const { getIdentityConfig } = await import('../src/main.js')
    expect(getIdentityConfig()).toBeNull()
  })

  it('returns config from identity context', async () => {
    globalThis.netlifyIdentityContext = {
      url: 'https://example.com/.netlify/identity',
      token: 'op-token',
    }
    const { getIdentityConfig } = await import('../src/main.js')
    const config = getIdentityConfig()
    expect(config).toEqual({
      url: 'https://example.com/.netlify/identity',
      token: 'op-token',
    })
  })

  it('falls back to Netlify.context.url when netlifyIdentityContext has no url', async () => {
    globalThis.netlifyIdentityContext = {
      user: {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
      },
    }
    globalThis.Netlify = { context: { url: 'https://example.netlify.app' } }
    const { getIdentityConfig } = await import('../src/main.js')
    const config = getIdentityConfig()
    expect(config).toEqual({
      url: 'https://example.netlify.app/.netlify/identity',
    })
  })
})

describe('getSettings', () => {
  beforeEach(() => {
    vi.resetModules()
    resetTestGoTrueClient()
  })

  afterEach(() => {
    delete globalThis.netlifyIdentityContext
    resetTestGoTrueClient()
    vi.resetAllMocks()
  })

  it('throws MissingIdentityError when no client is available', async () => {
    const { getSettings, MissingIdentityError } = await import('../src/main.js')
    await expect(getSettings()).rejects.toThrow(MissingIdentityError)
    await expect(getSettings()).rejects.toThrow('Netlify Identity is not available')
  })

  it('maps gotrue-js settings to the Settings type', async () => {
    globalThis.netlifyIdentityContext = {
      url: 'https://example.com/.netlify/identity',
    }

    const mockSettings = await getMockSettings()
    mockSettings.mockResolvedValue({
      autoconfirm: false,
      disable_signup: true,
      external: {
        google: true,
        github: true,
        gitlab: false,
        bitbucket: false,
        facebook: false,
        email: true,
      },
    })

    const { getSettings } = await import('../src/main.js')
    const settings = await getSettings()

    expect(settings.autoconfirm).toBe(false)
    expect(settings.disableSignup).toBe(true)
    expect(settings.providers.google).toBe(true)
    expect(settings.providers.github).toBe(true)
    expect(settings.providers.email).toBe(true)
    expect(settings.providers.gitlab).toBe(false)
  })

  it('wraps fetch errors in AuthError with status 502', async () => {
    globalThis.netlifyIdentityContext = {
      url: 'https://example.com/.netlify/identity',
    }

    const mockSettings = await getMockSettings()
    const networkError = new Error('Network error')
    mockSettings.mockRejectedValue(networkError)

    const { getSettings, AuthError } = await import('../src/main.js')
    const error = await getSettings().catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Network error')
    expect(error.status).toBe(502)
    expect(error.cause).toBe(networkError)
  })
})
