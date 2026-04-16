/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'

const mockCurrentUser = vi.fn().mockReturnValue(null)
const mockCreateUser = vi.fn()

vi.mock('gotrue-js', () => ({
  default: class MockGoTrue {
    currentUser = mockCurrentUser
    createUser = mockCreateUser
  },
}))

/** Builds a fake JWT (header.payload.signature) from a claims object. */
const fakeJwt = (claims: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.fake-signature`
}

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
  vi.resetAllMocks()
  mockCurrentUser.mockReturnValue(null)
  localStorage.clear()
  Object.defineProperty(document, 'cookie', { writable: true, value: '' })
})

afterEach(() => {
  resetTestGoTrueClient()
  localStorage.clear()
  Object.defineProperty(document, 'cookie', { writable: true, value: '' })
})

describe('getUser (browser)', () => {
  it('returns null when no session exists in localStorage', async () => {
    const { getUser } = await import('../src/user.js')
    expect(await getUser()).toBeNull()
  })

  it('returns user from nf_jwt cookie when no localStorage session', async () => {
    const jwt = fakeJwt({
      sub: 'cookie-user-123',
      email: 'cookie@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Cookie User' },
    })

    Object.defineProperty(document, 'cookie', { writable: true, value: `nf_jwt=${jwt}` })

    // hydrateSession calls client.createUser then toUser
    const mockGoTrueUser = {
      id: 'cookie-user-123',
      email: 'cookie@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Cookie User' },
    }
    mockCreateUser.mockResolvedValue(mockGoTrueUser)

    const { getUser } = await import('../src/user.js')
    const user = await getUser()
    if (!user) throw new Error('expected user to not be null')
    expect(user.id).toBe('cookie-user-123')
    expect(user.email).toBe('cookie@example.com')
    expect(user.provider).toBe('email')
    expect(user.name).toBe('Cookie User')
  })

  it('returns null when nf_jwt cookie contains invalid JWT', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'nf_jwt=not-a-jwt' })

    const { getUser } = await import('../src/user.js')
    expect(await getUser()).toBeNull()
  })
})

describe('isAuthenticated (browser)', () => {
  it('returns false when no session exists', async () => {
    const { isAuthenticated } = await import('../src/user.js')
    expect(await isAuthenticated()).toBe(false)
  })

  it('returns true when nf_jwt cookie is present', async () => {
    const jwt = fakeJwt({
      sub: 'cookie-user-123',
      email: 'cookie@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { provider: 'email' },
      user_metadata: {},
    })

    Object.defineProperty(document, 'cookie', { writable: true, value: `nf_jwt=${jwt}` })

    const mockGoTrueUser = {
      id: 'cookie-user-123',
      email: 'cookie@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: {},
    }
    mockCreateUser.mockResolvedValue(mockGoTrueUser)

    const { isAuthenticated } = await import('../src/user.js')
    expect(await isAuthenticated()).toBe(true)
  })
})
