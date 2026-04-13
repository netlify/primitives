/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser, clearBrowserAuthCookies } from './fixtures.js'

const mockLogin = vi.fn()
const mockSignup = vi.fn()
const mockLogout = vi.fn()
const mockUpdate = vi.fn()
const mockCurrentUser = vi.fn()
const mockLoginExternalUrl = vi.fn()
const mockCreateUser = vi.fn()
const mockConfirm = vi.fn()
const mockRecover = vi.fn()
const mockJwt = vi.fn()

vi.mock('gotrue-js', () => ({
  default: class MockGoTrue {
    login = mockLogin
    signup = mockSignup
    currentUser = mockCurrentUser
    loginExternalUrl = mockLoginExternalUrl
    createUser = mockCreateUser
    confirm = mockConfirm
    recover = mockRecover
  },
}))

const mockTokenDetails = {
  access_token: 'test-jwt-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}

const gotrueUserWithJwt = (overrides = {}) => {
  const user = makeGoTrueUser(overrides)
  return { ...user, jwt: mockJwt, tokenDetails: () => mockTokenDetails }
}

const gotrueUserWithMethods = (overrides = {}) => {
  const user = makeGoTrueUser(overrides)
  return { ...user, logout: mockLogout, update: mockUpdate, jwt: mockJwt, tokenDetails: () => mockTokenDetails }
}

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
  mockJwt.mockResolvedValue('test-jwt-token')
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  window.location.hash = ''
  clearBrowserAuthCookies()
})

describe('login', () => {
  it('returns a normalized User', async () => {
    const { login } = await import('../src/auth.js')
    mockLogin.mockResolvedValue(gotrueUserWithJwt())

    const user = await login('jane@example.com', 'password123')

    expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'password123', true)
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(user.provider).toBe('github')
  })

  it('emits a login event', async () => {
    const { login } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockLogin.mockResolvedValue(gotrueUserWithJwt())

    const cb = vi.fn()
    onAuthChange(cb)
    await login('jane@example.com', 'password123')

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })

  it('wraps gotrue-js errors in AuthError', async () => {
    const { login } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))

    const error = await login('jane@example.com', 'wrong').catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Invalid credentials')
  })
})

describe('signup', () => {
  it('returns a normalized User', async () => {
    const { signup } = await import('../src/auth.js')
    mockSignup.mockResolvedValue(makeGoTrueUser())

    const user = await signup('jane@example.com', 'password123')

    expect(mockSignup).toHaveBeenCalledWith('jane@example.com', 'password123', undefined)
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('passes user data to gotrue-js', async () => {
    const { signup } = await import('../src/auth.js')
    mockSignup.mockResolvedValue(makeGoTrueUser())

    await signup('jane@example.com', 'password123', { full_name: 'Jane Doe' })

    expect(mockSignup).toHaveBeenCalledWith('jane@example.com', 'password123', {
      full_name: 'Jane Doe',
    })
  })

  it('emits login event when autoconfirm is on', async () => {
    const { signup } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockSignup.mockResolvedValue(makeGoTrueUser({ confirmed_at: '2026-01-01T00:00:00Z' }))

    const cb = vi.fn()
    onAuthChange(cb)
    await signup('jane@example.com', 'password123')

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })

  it('sets nf_jwt cookie when autoconfirm is on', async () => {
    const { signup } = await import('../src/auth.js')
    mockJwt.mockResolvedValue('autoconfirm-jwt-token')
    mockSignup.mockResolvedValue({
      ...makeGoTrueUser({ confirmed_at: '2026-01-01T00:00:00Z' }),
      jwt: mockJwt,
      tokenDetails: () => ({ ...mockTokenDetails, access_token: 'autoconfirm-jwt-token' }),
    })

    await signup('jane@example.com', 'password123')

    expect(document.cookie).toContain('nf_jwt=autoconfirm-jwt-token')
  })

  it('does not set cookie when confirmation is required', async () => {
    const { signup } = await import('../src/auth.js')
    mockSignup.mockResolvedValue(makeGoTrueUser({ confirmed_at: null }))

    await signup('jane@example.com', 'password123')

    expect(document.cookie).not.toContain('nf_jwt')
  })

  it('does not emit login event when confirmation is required', async () => {
    const { signup } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockSignup.mockResolvedValue(makeGoTrueUser({ confirmed_at: null }))

    const cb = vi.fn()
    onAuthChange(cb)
    await signup('jane@example.com', 'password123')

    expect(cb).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('calls currentUser().logout()', async () => {
    const { logout } = await import('../src/auth.js')
    const mockUser = gotrueUserWithMethods()
    mockCurrentUser.mockReturnValue(mockUser)
    mockLogout.mockResolvedValue(undefined)

    await logout()

    expect(mockLogout).toHaveBeenCalled()
  })

  it('emits a logout event', async () => {
    const { logout } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue(gotrueUserWithMethods())
    mockLogout.mockResolvedValue(undefined)

    const cb = vi.fn()
    onAuthChange(cb)
    await logout()

    expect(cb).toHaveBeenCalledWith('logout', null)
  })

  it('emits logout even when no current user', async () => {
    const { logout } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue(null)

    const cb = vi.fn()
    onAuthChange(cb)
    await logout()

    expect(cb).toHaveBeenCalledWith('logout', null)
    expect(mockLogout).not.toHaveBeenCalled()
  })
})

describe('oauthLogin', () => {
  it('calls loginExternalUrl with the provider', async () => {
    const { oauthLogin } = await import('../src/auth.js')
    mockLoginExternalUrl.mockReturnValue('https://github.com/login/oauth/authorize?...')

    expect(() => oauthLogin('github')).toThrow('Redirecting to OAuth provider')
    expect(mockLoginExternalUrl).toHaveBeenCalledWith('github')
  })
})

describe('onAuthChange', () => {
  it('returns an unsubscribe function', async () => {
    const { login } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockLogin.mockResolvedValue(gotrueUserWithJwt())

    const cb = vi.fn()
    const unsub = onAuthChange(cb)

    unsub()
    await login('jane@example.com', 'password123')

    expect(cb).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', async () => {
    const { login } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockLogin.mockResolvedValue(gotrueUserWithJwt())

    const cb1 = vi.fn()
    const cb2 = vi.fn()
    onAuthChange(cb1)
    onAuthChange(cb2)
    await login('jane@example.com', 'password123')

    expect(cb1).toHaveBeenCalledOnce()
    expect(cb2).toHaveBeenCalledOnce()
  })

  it('fires on cross-tab storage events', async () => {
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue(makeGoTrueUser())

    const cb = vi.fn()
    onAuthChange(cb)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gotrue.user',
        newValue: '{"id":"550e8400-e29b-41d4-a716-446655440000"}',
      }),
    )

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })

  it('fires logout on cross-tab session removal', async () => {
    const { onAuthChange } = await import('../src/events.js')

    const cb = vi.fn()
    onAuthChange(cb)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gotrue.user',
        newValue: null,
      }),
    )

    expect(cb).toHaveBeenCalledWith('logout', null)
  })

  it('ignores storage events for other keys', async () => {
    const { onAuthChange } = await import('../src/events.js')

    const cb = vi.fn()
    onAuthChange(cb)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'whatever',
      }),
    )

    expect(cb).not.toHaveBeenCalled()
  })

  it('continues notifying other listeners when one throws', async () => {
    const { login } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockLogin.mockResolvedValue(gotrueUserWithJwt())

    const throwingCb = vi.fn(() => {
      throw new Error('subscriber error')
    })
    const survivingCb = vi.fn()
    onAuthChange(throwingCb)
    onAuthChange(survivingCb)
    await login('jane@example.com', 'password123')

    expect(throwingCb).toHaveBeenCalledOnce()
    expect(survivingCb).toHaveBeenCalledWith(
      'login',
      expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    )
  })
})

describe('hydrateSession', () => {
  it('reads cookies and calls createUser to hydrate the session', async () => {
    const { hydrateSession } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue(null)
    mockCreateUser.mockResolvedValue(makeGoTrueUser())

    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'nf_jwt=test-access-token; nf_refresh=test-refresh-token',
    })

    const cb = vi.fn()
    onAuthChange(cb)
    const user = await hydrateSession()

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
      }),
      true,
    )
    expect(user).toEqual(expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })

  it('is a no-op when a session already exists', async () => {
    const { hydrateSession } = await import('../src/auth.js')
    mockCurrentUser.mockReturnValue(gotrueUserWithJwt())

    const user = await hydrateSession()

    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(user).toEqual(expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })

  it('returns null when no cookies are present', async () => {
    const { hydrateSession } = await import('../src/auth.js')
    mockCurrentUser.mockReturnValue(null)

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })

    const user = await hydrateSession()

    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(user).toBeNull()
  })

  it('uses fallback expiry when JWT payload is not decodable', async () => {
    const { hydrateSession } = await import('../src/auth.js')
    mockCurrentUser.mockReturnValue(null)
    mockCreateUser.mockResolvedValue(makeGoTrueUser())

    Object.defineProperty(document, 'cookie', { writable: true, value: 'nf_jwt=not-a-valid-jwt' })

    await hydrateSession()

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'not-a-valid-jwt',
        token_type: 'bearer',
        expires_in: expect.any(Number),
        expires_at: expect.any(Number),
      }),
      true,
    )
    const callArgs = mockCreateUser.mock.calls[0][0]
    expect(callArgs.expires_in).toBeGreaterThan(0)
    expect(callArgs.expires_in).toBeLessThanOrEqual(3600)

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })

  it('hydrates with empty refresh token when only nf_jwt is present', async () => {
    const { hydrateSession } = await import('../src/auth.js')
    mockCurrentUser.mockReturnValue(null)
    mockCreateUser.mockResolvedValue(makeGoTrueUser())

    Object.defineProperty(document, 'cookie', { writable: true, value: 'nf_jwt=test-access-token' })

    await hydrateSession()

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'test-access-token',
        refresh_token: '',
      }),
      true,
    )

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })
})

describe('handleAuthCallback', () => {
  it('returns null when there is no hash', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')

    const result = await handleAuthCallback()
    expect(result).toBeNull()
  })

  it('handles OAuth access_token', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCreateUser.mockResolvedValue(makeGoTrueUser())

    window.location.hash =
      '#access_token=test-token&token_type=bearer&expires_in=3600&expires_at=9999999999&refresh_token=refresh-123'

    const cb = vi.fn()
    onAuthChange(cb)
    const result = await handleAuthCallback()

    expect(result).toEqual({
      type: 'oauth',
      user: expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    })
    expect(mockCreateUser).toHaveBeenCalledWith(
      {
        access_token: 'test-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 9999999999,
        refresh_token: 'refresh-123',
      },
      true,
    )
    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(window.location.hash).toBe('')
  })

  it('handles confirmation_token', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    mockConfirm.mockResolvedValue(gotrueUserWithJwt())

    window.location.hash = '#confirmation_token=confirm-abc'

    const result = await handleAuthCallback()

    expect(result).toEqual({
      type: 'confirmation',
      user: expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    })
    expect(mockConfirm).toHaveBeenCalledWith('confirm-abc', true)
  })

  it('handles recovery_token', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    mockRecover.mockResolvedValue(gotrueUserWithJwt())

    const cb = vi.fn()
    onAuthChange(cb)

    window.location.hash = '#recovery_token=recover-abc'

    const result = await handleAuthCallback()

    expect(result).toEqual({
      type: 'recovery',
      user: expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    })
    expect(mockRecover).toHaveBeenCalledWith('recover-abc', true)
    expect(cb).toHaveBeenCalledWith('recovery', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })

  it('handles invite_token without completing the flow', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')

    window.location.hash = '#invite_token=invite-abc'

    const result = await handleAuthCallback()

    expect(result).toEqual({
      type: 'invite',
      user: null,
      token: 'invite-abc',
    })
  })

  it('handles email_change_token by calling PUT /user', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { onAuthChange } = await import('../src/events.js')
    const userData = makeGoTrueUser()
    mockCurrentUser.mockReturnValue({ jwt: mockJwt })
    mockJwt.mockResolvedValue('test-jwt-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData),
      }),
    )

    window.location.hash = '#email_change_token=change-abc'

    const cb = vi.fn()
    onAuthChange(cb)
    const result = await handleAuthCallback()

    expect(result).toEqual({
      type: 'email_change',
      user: expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/.netlify/identity/user'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ email_change_token: 'change-abc' }),
      }),
    )
    expect(cb).toHaveBeenCalledWith(
      'user_updated',
      expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    )
  })

  it('throws AuthError when email_change API returns an error', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')
    mockCurrentUser.mockReturnValue({ jwt: mockJwt })
    mockJwt.mockResolvedValue('test-jwt-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ msg: 'Invalid email change token' }),
      }),
    )

    window.location.hash = '#email_change_token=bad-token'

    const error = await handleAuthCallback().catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Invalid email change token')
    expect(error.status).toBe(422)
  })

  it('throws AuthError for email_change_token when no session exists', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')
    mockCurrentUser.mockReturnValue(null)

    window.location.hash = '#email_change_token=change-abc'

    const error = await handleAuthCallback().catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Email change verification requires an active browser session')
  })

  it('clears the URL hash after handling', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    mockConfirm.mockResolvedValue(gotrueUserWithJwt())

    window.location.hash = '#confirmation_token=confirm-abc'
    await handleAuthCallback()

    expect(window.location.hash).toBe('')
  })

  it('wraps errors in AuthError', async () => {
    const { handleAuthCallback } = await import('../src/auth.js')
    const { AuthError } = await import('../src/errors.js')
    mockConfirm.mockRejectedValue(new Error('Invalid token'))

    window.location.hash = '#confirmation_token=bad-token'

    const error = await handleAuthCallback().catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('Invalid token')
  })
})
