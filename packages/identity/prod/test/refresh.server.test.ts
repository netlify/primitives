import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'

const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}

const IDENTITY_URL = 'https://example.netlify.app/.netlify/identity'

/** Builds a fake JWT (header.payload.signature) from claims. */
const fakeJwt = (claims: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.fake-signature`
}

const expiredJwt = fakeJwt({
  sub: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
})

const nearExpiryJwt = fakeJwt({
  sub: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  exp: Math.floor(Date.now() / 1000) + 30, // expires in 30s (under 60s margin)
})

const validJwt = fakeJwt({
  sub: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
})

const freshAccessToken = fakeJwt({
  sub: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
})

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()

  globalThis.netlifyIdentityContext = {
    url: IDENTITY_URL,
    token: 'test-operator-token',
  }

  globalThis.Netlify = {
    context: {
      cookies: mockCookies,
    },
  } as unknown as typeof globalThis.Netlify
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  delete globalThis.netlifyIdentityContext
  delete (globalThis as Record<string, unknown>).Netlify
})

describe('refreshSession (server)', () => {
  it('refreshes an expired token and updates cookies', async () => {
    mockCookies.get
      .mockReturnValueOnce(expiredJwt) // nf_jwt
      .mockReturnValueOnce('old-refresh-token') // nf_refresh

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: freshAccessToken,
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'new-refresh-token',
          }),
      }),
    )

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBe(freshAccessToken)

    // Verify GoTrue /token endpoint was called with refresh_token grant
    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/token`,
      expect.objectContaining({
        method: 'POST',
        body: 'grant_type=refresh_token&refresh_token=old-refresh-token',
      }),
    )

    // Verify cookies were updated
    expect(mockCookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: 'nf_jwt', value: freshAccessToken }))
    expect(mockCookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'nf_refresh', value: 'new-refresh-token' }),
    )
  })

  it('refreshes a near-expiry token (within 60s margin)', async () => {
    mockCookies.get.mockReturnValueOnce(nearExpiryJwt).mockReturnValueOnce('test-refresh-token')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: freshAccessToken,
            refresh_token: 'new-refresh-token',
          }),
      }),
    )

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBe(freshAccessToken)
    expect(fetch).toHaveBeenCalled()
  })

  it('returns null when token is still valid', async () => {
    mockCookies.get.mockReturnValueOnce(validJwt).mockReturnValueOnce('test-refresh-token')

    vi.stubGlobal('fetch', vi.fn())

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when no nf_jwt cookie exists', async () => {
    mockCookies.get.mockReturnValue(null)

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })

  it('returns null when no nf_refresh cookie exists', async () => {
    mockCookies.get
      .mockReturnValueOnce(expiredJwt) // nf_jwt present
      .mockReturnValueOnce(null) // nf_refresh missing

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })

  it('returns null when refresh token is invalid (401)', async () => {
    mockCookies.get.mockReturnValueOnce(expiredJwt).mockReturnValueOnce('invalid-refresh-token')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ msg: 'Invalid Refresh Token' }),
      }),
    )

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })

  it('returns null when refresh token is invalid (400)', async () => {
    mockCookies.get.mockReturnValueOnce(expiredJwt).mockReturnValueOnce('invalid-refresh-token')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error_description: 'Invalid Refresh Token' }),
      }),
    )

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })

  it('throws AuthError on server error (500)', async () => {
    mockCookies.get.mockReturnValueOnce(expiredJwt).mockReturnValueOnce('test-refresh-token')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ msg: 'Internal Server Error' }),
      }),
    )

    const { refreshSession } = await import('../src/refresh.js')
    const { AuthError } = await import('../src/errors.js')

    await expect(refreshSession()).rejects.toThrow(AuthError)
  })

  it('throws AuthError on network failure', async () => {
    mockCookies.get.mockReturnValueOnce(expiredJwt).mockReturnValueOnce('test-refresh-token')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')))

    const { refreshSession } = await import('../src/refresh.js')
    const { AuthError } = await import('../src/errors.js')

    await expect(refreshSession()).rejects.toThrow(AuthError)
  })

  it('throws AuthError when identity URL cannot be determined', async () => {
    mockCookies.get.mockReturnValueOnce(expiredJwt).mockReturnValueOnce('test-refresh-token')

    // Remove identity URL sources but keep cookies available
    delete globalThis.netlifyIdentityContext
    globalThis.Netlify = {
      context: {
        cookies: mockCookies,
        // no url property
      },
    } as unknown as typeof globalThis.Netlify

    const { refreshSession } = await import('../src/refresh.js')
    const { AuthError } = await import('../src/errors.js')

    await expect(refreshSession()).rejects.toThrow(AuthError)
  })
})
