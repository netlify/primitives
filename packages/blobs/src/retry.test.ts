import { afterEach, expect, test, vi } from 'vitest'

import { fetchAndRetry } from './retry.ts'

afterEach(() => {
  vi.useRealTimers()
})

test('uses the production retry delay in test environments', async () => {
  vi.useFakeTimers()

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
