import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser } from './fixtures.js'

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

const TEST_JWT_CLAIMS = {
  sub: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
  app_metadata: { provider: 'github' },
  user_metadata: { full_name: 'Jane Doe' },
}

const TEST_ACCESS_TOKEN = fakeJwt(TEST_JWT_CLAIMS)

const mockTokenResponse = () => ({
  access_token: TEST_ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
})

const mockGoTrueSignupResponse = (overrides: Record<string, unknown> = {}) => {
  const user = makeGoTrueUser()
  return { ...user, ...overrides }
}

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

describe('login (server)', () => {
  it('POSTs to /token then GETs /user and sets nf_jwt cookie', async () => {
    const userData = makeGoTrueUser()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(userData),
        }),
    )

    const { login } = await import('../src/auth.js')
    const user = await login('jane@example.com', 'password123')

    expect(fetch).toHaveBeenCalledTimes(2)

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `${IDENTITY_URL}/token`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    )

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = callArgs[1]?.body as string
    expect(body).toContain('grant_type=password')
    expect(body).toContain('username=jane%40example.com')
    expect(body).toContain('password=password123')

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${IDENTITY_URL}/user`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      }),
    )

    expect(mockCookies.set).toHaveBeenCalledWith({
      name: 'nf_jwt',
      value: TEST_ACCESS_TOKEN,
      httpOnly: false,
      secure: true,
      path: '/',
      sameSite: 'Lax',
    })

    expect(mockCookies.set).toHaveBeenCalledWith({
      name: 'nf_refresh',
      value: 'test-refresh-token',
      httpOnly: false,
      secure: true,
      path: '/',
      sameSite: 'Lax',
    })

    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
  })

  it('returns a User with real fields from the /user endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              makeGoTrueUser({
                user_metadata: { full_name: 'Jane Doe', avatar_url: 'https://example.com/avatar.png' },
              }),
            ),
        }),
    )

    const { login } = await import('../src/auth.js')
    const user = await login('jane@example.com', 'password123')

    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(user.name).toBe('Jane Doe')
    expect(user.pictureUrl).toBe('https://example.com/avatar.png')
    expect(user.provider).toBe('github')
  })

  it('throws AuthError when /user fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse()),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ msg: 'Invalid token' }),
        }),
    )

    const { login } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await login('jane@example.com', 'password123').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Invalid token')
    expect(error.status).toBe(401)
  })

  it('throws AuthError with status on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ msg: 'Invalid credentials' }),
      }),
    )

    const { login } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await login('jane@example.com', 'wrong').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Invalid credentials')
    expect(error.status).toBe(401)
  })

  it('throws AuthError when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { login } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await login('jane@example.com', 'password123').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Network error')
  })

  it('throws AuthError when Netlify.context.cookies is not available', async () => {
    delete (globalThis as Record<string, unknown>).Netlify

    const { login } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await login('jane@example.com', 'password123').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Server-side auth requires Netlify Functions runtime')
  })
})

describe('signup (server)', () => {
  it('POSTs to /signup with JSON body and returns normalized User', async () => {
    const signupResponse = mockGoTrueSignupResponse({ confirmed_at: null })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(signupResponse),
      }),
    )

    const { signup } = await import('../src/auth.js')
    const user = await signup('jane@example.com', 'password123', { full_name: 'Jane Doe' })

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/signup`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com', password: 'password123', data: { full_name: 'Jane Doe' } }),
      }),
    )

    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(mockCookies.set).not.toHaveBeenCalled()
  })

  it('sets nf_jwt and nf_refresh cookies when autoconfirm is on', async () => {
    const autoConfirmToken = fakeJwt(TEST_JWT_CLAIMS)
    const signupResponse = mockGoTrueSignupResponse({
      confirmed_at: '2026-01-01T00:00:00Z',
      access_token: autoConfirmToken,
      refresh_token: 'auto-confirm-refresh',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(signupResponse),
      }),
    )

    const { signup } = await import('../src/auth.js')
    await signup('jane@example.com', 'password123')

    expect(mockCookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'nf_jwt',
        value: autoConfirmToken,
        httpOnly: false,
      }),
    )
    expect(mockCookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'nf_refresh',
        value: 'auto-confirm-refresh',
        httpOnly: false,
      }),
    )
  })

  it('does not set cookie when autoconfirm is off', async () => {
    const signupResponse = mockGoTrueSignupResponse({ confirmed_at: null })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(signupResponse),
      }),
    )

    const { signup } = await import('../src/auth.js')
    await signup('jane@example.com', 'password123')

    expect(mockCookies.set).not.toHaveBeenCalled()
  })

  it('does not set cookie when confirmed but no access_token', async () => {
    const signupResponse = mockGoTrueSignupResponse({
      confirmed_at: '2026-01-01T00:00:00Z',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(signupResponse),
      }),
    )

    const { signup } = await import('../src/auth.js')
    await signup('jane@example.com', 'password123')

    expect(mockCookies.set).not.toHaveBeenCalled()
  })

  it('throws AuthError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ msg: 'User already exists' }),
      }),
    )

    const { signup } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await signup('jane@example.com', 'password123').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('User already exists')
    expect(error.status).toBe(422)
  })
})

describe('logout (server)', () => {
  it('POSTs to /logout with Bearer token and deletes both cookies', async () => {
    mockCookies.get.mockReturnValue('existing-jwt-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const { logout } = await import('../src/auth.js')
    await logout()

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/logout`,
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer existing-jwt-token' },
      }),
    )

    expect(mockCookies.delete).toHaveBeenCalledWith('nf_jwt')
    expect(mockCookies.delete).toHaveBeenCalledWith('nf_refresh')
  })

  it('deletes both cookies even when no JWT exists (skip /logout call)', async () => {
    mockCookies.get.mockReturnValue(undefined)
    vi.stubGlobal('fetch', vi.fn())

    const { logout } = await import('../src/auth.js')
    await logout()

    expect(fetch).not.toHaveBeenCalled()
    expect(mockCookies.delete).toHaveBeenCalledWith('nf_jwt')
    expect(mockCookies.delete).toHaveBeenCalledWith('nf_refresh')
  })

  it('still deletes cookies when fetch fails', async () => {
    mockCookies.get.mockReturnValue('existing-jwt-token')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { logout } = await import('../src/auth.js')

    await logout()

    expect(mockCookies.delete).toHaveBeenCalledWith('nf_jwt')
    expect(mockCookies.delete).toHaveBeenCalledWith('nf_refresh')
  })

  it('throws AuthError when Netlify.context.cookies is not available', async () => {
    delete (globalThis as Record<string, unknown>).Netlify

    const { logout } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await logout().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Server-side auth requires Netlify Functions runtime')
  })
})
