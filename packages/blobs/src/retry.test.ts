import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('does not access the process environment during import', async () => {
  const accessEnvironment = vi.fn(() => {
    throw new Error('Environment access is not allowed')
  })
  vi.stubGlobal('process', {
    get env() {
      return accessEnvironment()
    },
  })

  await expect(import('./retry.ts')).resolves.toHaveProperty('fetchAndRetry')
  expect(accessEnvironment).not.toHaveBeenCalled()
})

test('uses the production retry delay in test environments', async () => {
  vi.useFakeTimers()

  const { fetchAndRetry } = await import('./retry.ts')
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 500 }))
    .mockResolvedValueOnce(new Response(null))
  const response = fetchAndRetry(fetch, 'https://example.com', {})

  await vi.advanceTimersByTimeAsync(4999)
  expect(fetch).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(1)
  await expect(response).resolves.toHaveProperty('status', 200)
  expect(fetch).toHaveBeenCalledTimes(2)
})
