/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser, clearBrowserAuthCookies } from './fixtures.js'

const mockRequestPasswordRecovery = vi.fn()
const mockRecover = vi.fn()
const mockConfirm = vi.fn()
const mockAcceptInvite = vi.fn()
const mockCurrentUser = vi.fn()
const mockUpdate = vi.fn()
const mockJwt = vi.fn()
const mockCreateUser = vi.fn()

vi.mock('gotrue-js', () => ({
  default: class MockGoTrue {
    requestPasswordRecovery = mockRequestPasswordRecovery
    recover = mockRecover
    confirm = mockConfirm
    acceptInvite = mockAcceptInvite
    currentUser = mockCurrentUser
    createUser = mockCreateUser
  },
}))

const gotrueUserWithUpdate = (overrides = {}) => {
  const user = makeGoTrueUser(overrides)
  return { ...user, update: mockUpdate }
}

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  clearBrowserAuthCookies()
})

describe('requestPasswordRecovery', () => {
  it('calls client.requestPasswordRecovery', async () => {
    const { requestPasswordRecovery } = await import('../src/account.js')
    mockRequestPasswordRecovery.mockResolvedValue(undefined)

    await requestPasswordRecovery('jane@example.com')

    expect(mockRequestPasswordRecovery).toHaveBeenCalledWith('jane@example.com')
  })
})

describe('recoverPassword', () => {
  it('recovers the token then updates the password', async () => {
    const { recoverPassword } = await import('../src/account.js')
    const recoveredUser = gotrueUserWithUpdate()
    mockRecover.mockResolvedValue(recoveredUser)
    mockUpdate.mockResolvedValue(makeGoTrueUser())

    const user = await recoverPassword('recovery-token', 'new-password')

    expect(mockRecover).toHaveBeenCalledWith('recovery-token', true)
    expect(mockUpdate).toHaveBeenCalledWith({ password: 'new-password' })
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('emits a login event', async () => {
    const { recoverPassword } = await import('../src/account.js')
    const { onAuthChange } = await import('../src/events.js')
    mockRecover.mockResolvedValue(gotrueUserWithUpdate())
    mockUpdate.mockResolvedValue(makeGoTrueUser())

    const cb = vi.fn()
    onAuthChange(cb)
    await recoverPassword('recovery-token', 'new-password')

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })
})

describe('confirmEmail', () => {
  it('confirms the token and returns a user', async () => {
    const { confirmEmail } = await import('../src/account.js')
    mockConfirm.mockResolvedValue(makeGoTrueUser())

    const user = await confirmEmail('confirm-token')

    expect(mockConfirm).toHaveBeenCalledWith('confirm-token', true)
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('emits a login event', async () => {
    const { confirmEmail } = await import('../src/account.js')
    const { onAuthChange } = await import('../src/events.js')
    mockConfirm.mockResolvedValue(makeGoTrueUser())

    const cb = vi.fn()
    onAuthChange(cb)
    await confirmEmail('confirm-token')

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })
})

describe('acceptInvite', () => {
  it('accepts the invite with a password', async () => {
    const { acceptInvite } = await import('../src/account.js')
    mockAcceptInvite.mockResolvedValue(makeGoTrueUser())

    const user = await acceptInvite('invite-token', 'my-password')

    expect(mockAcceptInvite).toHaveBeenCalledWith('invite-token', 'my-password', true)
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('emits a login event', async () => {
    const { acceptInvite } = await import('../src/account.js')
    const { onAuthChange } = await import('../src/events.js')
    mockAcceptInvite.mockResolvedValue(makeGoTrueUser())

    const cb = vi.fn()
    onAuthChange(cb)
    await acceptInvite('invite-token', 'my-password')

    expect(cb).toHaveBeenCalledWith('login', expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }))
  })
})

describe('verifyEmailChange', () => {
  it('calls PUT /user with email_change_token', async () => {
    const { verifyEmailChange } = await import('../src/account.js')
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

    const user = await verifyEmailChange('change-token')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/.netlify/identity/user'),
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-jwt-token',
        },
        body: JSON.stringify({ email_change_token: 'change-token' }),
      }),
    )
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('emits a user_updated event', async () => {
    const { verifyEmailChange } = await import('../src/account.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue({ jwt: mockJwt })
    mockJwt.mockResolvedValue('test-jwt-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const cb = vi.fn()
    onAuthChange(cb)
    await verifyEmailChange('change-token')

    expect(cb).toHaveBeenCalledWith(
      'user_updated',
      expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    )
  })

  it('throws AuthError when no user is logged in', async () => {
    const { verifyEmailChange } = await import('../src/account.js')
    const { AuthError } = await import('../src/errors.js')
    mockCurrentUser.mockReturnValue(null)

    const error = await verifyEmailChange('change-token').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('No user is currently logged in')
  })
})

describe('updateUser', () => {
  it('updates the current user', async () => {
    const { updateUser } = await import('../src/account.js')
    mockCurrentUser.mockReturnValue(gotrueUserWithUpdate())
    mockUpdate.mockResolvedValue(makeGoTrueUser({ user_metadata: { full_name: 'New Name' } }))

    const user = await updateUser({ data: { full_name: 'New Name' } })

    expect(mockUpdate).toHaveBeenCalledWith({ data: { full_name: 'New Name' } })
    expect(user.name).toBe('New Name')
  })

  it('emits a user_updated event', async () => {
    const { updateUser } = await import('../src/account.js')
    const { onAuthChange } = await import('../src/events.js')
    mockCurrentUser.mockReturnValue(gotrueUserWithUpdate())
    mockUpdate.mockResolvedValue(makeGoTrueUser())

    const cb = vi.fn()
    onAuthChange(cb)
    await updateUser({ data: { full_name: 'New Name' } })

    expect(cb).toHaveBeenCalledWith(
      'user_updated',
      expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    )
  })

  it('throws AuthError when no user is logged in', async () => {
    const { updateUser } = await import('../src/account.js')
    const { AuthError } = await import('../src/errors.js')
    mockCurrentUser.mockReturnValue(null)

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })

    const error = await updateUser({ data: { full_name: 'New Name' } }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.message).toBe('No user is currently logged in')

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })

  it('auto-hydrates from cookies when no session but cookies exist', async () => {
    const { updateUser } = await import('../src/account.js')

    const hydratedUser = gotrueUserWithUpdate()
    mockCurrentUser
      .mockReturnValueOnce(null) // first check: no session
      .mockReturnValueOnce(null) // hydrateSession internal check
      .mockReturnValueOnce(hydratedUser) // after hydration
      .mockReturnValueOnce(hydratedUser) // startTokenRefresh reads currentUser
    mockCreateUser.mockResolvedValue(makeGoTrueUser())
    mockUpdate.mockResolvedValue(makeGoTrueUser({ user_metadata: { full_name: 'New Name' } }))

    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'nf_jwt=test-access-token; nf_refresh=test-refresh-token',
    })

    const user = await updateUser({ data: { full_name: 'New Name' } })

    expect(mockCreateUser).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ data: { full_name: 'New Name' } })
    expect(user.name).toBe('New Name')

    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
  })
})
