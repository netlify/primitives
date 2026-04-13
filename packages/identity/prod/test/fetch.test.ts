import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchWithTimeout } from '../src/fetch.js'
import { AuthError } from '../src/errors.js'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the response when fetch completes within the timeout', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const res = await fetchWithTimeout('https://example.com/.netlify/identity/user', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res).toBe(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/.netlify/identity/user',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('forwards request options to fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

    await fetchWithTimeout('https://example.com/.netlify/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=password',
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/.netlify/identity/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=password',
      }),
    )
  })

  it('throws AuthError with pathname and timeout when request times out', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          ;(options as RequestInit).signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const promise = fetchWithTimeout('https://example.com/.netlify/identity/user', {}, 100)

    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow(AuthError)
    await promise.catch((error) => {
      expect(error.message).toContain('/.netlify/identity/user')
      expect(error.message).toContain('100ms')
    })

    vi.useRealTimers()
  })

  it('re-throws non-timeout errors without wrapping', async () => {
    const networkError = new Error('getaddrinfo ENOTFOUND example.com')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError)

    try {
      await fetchWithTimeout('https://example.com/.netlify/identity/user')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBe(networkError)
      expect(error).not.toBeInstanceOf(AuthError)
    }
  })

  it('does not leak query params in timeout error messages', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          ;(options as RequestInit).signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )

    const promise = fetchWithTimeout(
      'https://example.com/.netlify/identity/token?secret=sensitive&refresh_token=abc',
      {},
      100,
    )

    vi.advanceTimersByTime(100)

    await promise.catch((error) => {
      expect(error).toBeInstanceOf(AuthError)
      expect(error.message).toContain('/.netlify/identity/token')
      expect(error.message).not.toContain('secret=sensitive')
      expect(error.message).not.toContain('refresh_token=abc')
      expect(error.message).not.toContain('example.com')
    })

    vi.useRealTimers()
  })
})
