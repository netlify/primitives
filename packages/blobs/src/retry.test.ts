import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('does not read protected Deno environment variables during import', async () => {
  const getEnvironmentVariable = vi.fn(() => {
    throw new Error('Requires env access')
  })
  vi.stubGlobal('Deno', { env: { get: getEnvironmentVariable } })

  const { getStore } = await import('./main.ts')
  const store = getStore({ name: 'store', siteID: 'site-id', token: 'token' })

  expect(store).toBeDefined()
  expect(getEnvironmentVariable).not.toHaveBeenCalled()
})

test('uses the shorter retry delay in Node test environments', async () => {
  vi.useFakeTimers()

  const { fetchAndRetry } = await import('./retry.ts')
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 500 }))
    .mockResolvedValueOnce(new Response(null))
  const response = fetchAndRetry(fetch, 'https://example.com', {})

  await vi.advanceTimersByTimeAsync(0)
  expect(fetch).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(1)
  await expect(response).resolves.toHaveProperty('status', 200)
  expect(fetch).toHaveBeenCalledTimes(2)
})
