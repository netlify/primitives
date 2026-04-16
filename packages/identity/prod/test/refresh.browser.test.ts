/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser, clearBrowserAuthCookies } from './fixtures.js'

const mockCurrentUser = vi.fn()
const mockJwt = vi.fn()

const futureExpiry = Math.floor(Date.now() / 1000) + 3600

const mockTokenDetails = vi.fn().mockReturnValue({
  access_token: 'test-jwt-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: futureExpiry,
})

vi.mock('gotrue-js', () => ({
  default: class MockGoTrue {
    currentUser = mockCurrentUser
  },
}))

const gotrueUserWithJwt = (overrides = {}) => {
  const user = makeGoTrueUser(overrides)
  return { ...user, jwt: mockJwt, tokenDetails: mockTokenDetails }
}

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
  vi.useFakeTimers()
  mockJwt.mockResolvedValue('refreshed-jwt-token')
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  vi.useRealTimers()
  clearBrowserAuthCookies()
})

describe('startTokenRefresh (browser)', () => {
  it('schedules a refresh before token expiry', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)

    const { startTokenRefresh, stopTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    // Token expires in 3600s, refresh margin is 60s, so timer fires at 3540s
    // Advance to just before the refresh should fire
    vi.advanceTimersByTime(3539 * 1000)
    expect(mockJwt).not.toHaveBeenCalled()

    // Advance past the refresh point
    vi.advanceTimersByTime(2 * 1000)
    await vi.runOnlyPendingTimersAsync()

    expect(mockJwt).toHaveBeenCalledWith(true)
    stopTokenRefresh()
  })

  it('refreshes token and syncs cookies when timer fires', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)
    mockTokenDetails.mockReturnValue({
      access_token: 'refreshed-jwt-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      expires_at: futureExpiry,
    })

    const { startTokenRefresh, stopTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    await vi.advanceTimersByTimeAsync(3541 * 1000)
    await Promise.resolve()

    // Verify the refresh happened and tokenDetails were read for cookie sync
    expect(mockJwt).toHaveBeenCalledWith(true)
    expect(mockTokenDetails).toHaveBeenCalled()
    stopTokenRefresh()
  })

  it('is a no-op when no user is logged in', async () => {
    mockCurrentUser.mockReturnValue(null)

    const { startTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    vi.advanceTimersByTime(4000 * 1000)
    expect(mockJwt).not.toHaveBeenCalled()
  })

  it('is a no-op when user has no tokenDetails', async () => {
    const user = makeGoTrueUser()
    mockCurrentUser.mockReturnValue({ ...user, tokenDetails: () => null })

    const { startTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    vi.advanceTimersByTime(4000 * 1000)
    expect(mockJwt).not.toHaveBeenCalled()
  })

  it('stops retrying when refresh fails', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)
    // Token expires in 10s (under 60s margin), so timer fires immediately
    mockTokenDetails.mockReturnValue({
      access_token: 'old-token',
      refresh_token: 'test-refresh',
      expires_in: 10,
      expires_at: Math.floor(Date.now() / 1000) + 10,
    })
    mockJwt.mockRejectedValue(new Error('Refresh token revoked'))

    const { startTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    await vi.advanceTimersByTimeAsync(1)

    expect(mockJwt).toHaveBeenCalledWith(true)

    // Should not schedule another refresh after failure
    mockJwt.mockClear()
    await vi.advanceTimersByTimeAsync(7200 * 1000)
    expect(mockJwt).not.toHaveBeenCalled()
  })

  it('restarts timer when called multiple times', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)

    const { startTokenRefresh, stopTokenRefresh } = await import('../src/refresh.js')

    // First start with a far-future expiry
    startTokenRefresh()

    // Now restart with a near-expiry token (fires immediately)
    mockTokenDetails.mockReturnValue({
      access_token: 'old-token',
      refresh_token: 'test-refresh',
      expires_in: 5,
      expires_at: Math.floor(Date.now() / 1000) + 5,
    })
    startTokenRefresh()

    await vi.advanceTimersByTimeAsync(1)
    expect(mockJwt).toHaveBeenCalledWith(true)

    stopTokenRefresh()
  })

  it('fires immediately when token is already near expiry', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)
    mockTokenDetails.mockReturnValue({
      access_token: 'old-token',
      refresh_token: 'test-refresh',
      expires_in: 30,
      expires_at: Math.floor(Date.now() / 1000) + 30, // 30s left, under 60s margin
    })

    const { startTokenRefresh, stopTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()

    // delay should be max(0, ...) = 0, so fires on next tick
    vi.advanceTimersByTime(1)
    await vi.runOnlyPendingTimersAsync()

    expect(mockJwt).toHaveBeenCalledWith(true)
    stopTokenRefresh()
  })
})

describe('stopTokenRefresh', () => {
  it('cancels a pending refresh', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)

    const { startTokenRefresh, stopTokenRefresh } = await import('../src/refresh.js')
    startTokenRefresh()
    stopTokenRefresh()

    vi.advanceTimersByTime(4000 * 1000)
    await vi.runOnlyPendingTimersAsync()
    expect(mockJwt).not.toHaveBeenCalled()
  })

  it('is safe to call when no timer is running', async () => {
    const { stopTokenRefresh } = await import('../src/refresh.js')
    expect(() => {
      stopTokenRefresh()
    }).not.toThrow()
  })
})

describe('refreshSession (browser)', () => {
  it('calls user.jwt() and updates cookie', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBe('refreshed-jwt-token')
    expect(mockJwt).toHaveBeenCalled()
    expect(document.cookie).toContain('nf_jwt=refreshed-jwt-token')
  })

  it('returns null when no user is logged in', async () => {
    mockCurrentUser.mockReturnValue(null)

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })

  it('returns null when jwt() throws', async () => {
    const user = gotrueUserWithJwt()
    mockCurrentUser.mockReturnValue(user)
    mockJwt.mockRejectedValue(new Error('Token expired'))

    const { refreshSession } = await import('../src/refresh.js')
    const result = await refreshSession()

    expect(result).toBeNull()
  })
})
