import type { Mock } from 'vitest'
import { vi } from 'vitest'

import { Client } from './client.js'

export const payload = {
  id: '3f7qk2wm9xbt5r0v',
  site_id: '2f7a6c1e-9b3d-4e58-a0c7-51d2f8e4b36a',
  hostname: 'sandbox-3f7qk2wm9xbt5r0v--mysite.netlify.app',
  memory_mb: 2048,
  vcpus: 2,
  disk_size_mb: 2048,
  created_at: '2026-09-08T12:00:00Z',
}

export type FetchMock = Mock<typeof globalThis.fetch>

export const base64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export const mockFetch = (...responses: Response[]): FetchMock => {
  const fetch = vi.fn<typeof globalThis.fetch>()

  for (const response of responses) {
    fetch.mockResolvedValueOnce(response)
  }

  return fetch
}

export const client = (fetch: FetchMock) => new Client({ token: 'token', siteID: payload.site_id, fetch })

// callOf reads one recorded request back in a shape the assertions can use.
export const callOf = (fetch: FetchMock, index: number) => {
  const [input, init = {}] = fetch.mock.calls[index]

  // Narrowed rather than stringified: this package always sends a URL string
  // and a JSON string body, so anything else here is a bug.
  return {
    url: input as string,
    method: init.method,
    headers: (init.headers ?? {}) as Record<string, string>,
    body: JSON.parse((init.body as string | undefined) ?? '{}') as Record<string, unknown>,
  }
}
