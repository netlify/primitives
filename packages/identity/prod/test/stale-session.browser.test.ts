/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser } from './fixtures.js'

const mockClearSession = vi.fn()
const mockCurrentUser = vi.fn()

vi.mock('gotrue-js', () => ({
  default: class MockGoTrue {
    currentUser = mockCurrentUser
  },
}))

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
  Object.defineProperty(document, 'cookie', { writable: true, value: '' })
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  Object.defineProperty(document, 'cookie', { writable: true, value: '' })
})

describe('stale session detection (browser)', () => {
  it('clears stale session and returns null when localStorage has user but nf_jwt cookie is gone', async () => {
    const gotrueUser = { ...makeGoTrueUser(), clearSession: mockClearSession }
    mockCurrentUser.mockReturnValue(gotrueUser)

    // No nf_jwt cookie (server logged us out)
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })

    const { getUser } = await import('../src/user.js')
    const user = await getUser()

    expect(user).toBeNull()
    expect(mockClearSession).toHaveBeenCalledOnce()
  })

  it('returns user normally when localStorage has user and nf_jwt cookie exists', async () => {
    const gotrueUser = { ...makeGoTrueUser(), clearSession: mockClearSession, tokenDetails: vi.fn() }
    mockCurrentUser.mockReturnValue(gotrueUser)

    const header = btoa(JSON.stringify({ alg: 'HS256' }))
    const payload = btoa(JSON.stringify({ sub: '550e8400-e29b-41d4-a716-446655440000' }))
    Object.defineProperty(document, 'cookie', { writable: true, value: `nf_jwt=${header}.${payload}.sig` })

    const { getUser } = await import('../src/user.js')
    const user = await getUser()

    expect(user).not.toBeNull()
    expect(user!.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(mockClearSession).not.toHaveBeenCalled()
  })

  it('returns null on subsequent calls after stale session is cleared', async () => {
    const gotrueUser = { ...makeGoTrueUser(), clearSession: mockClearSession }

    // First call: gotrue has a user, no cookie
    mockCurrentUser.mockReturnValue(gotrueUser)
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })

    const { getUser } = await import('../src/user.js')
    expect(await getUser()).toBeNull()
    expect(mockClearSession).toHaveBeenCalledOnce()

    // Second call: clearSession worked, gotrue returns null
    mockCurrentUser.mockReturnValue(null)
    expect(await getUser()).toBeNull()
  })
})
