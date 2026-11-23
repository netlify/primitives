import { errorFromResponse } from './error.js'

export interface RequestOptions {
  body?: unknown
  method?: string
  signal?: AbortSignal
}

/** Sends a request to a sandbox's own API. */
export type SandboxRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

/**
 * Sends an authenticated JSON request. It resolves with the parsed body, or
 * with `undefined` for a response without one, and rejects with a
 * `SandboxError` for a response that isn't a success.
 */
export const sendJSON = async <T>(
  fetch: typeof globalThis.fetch,
  url: string,
  token: string,
  { body, method = 'POST', signal }: RequestOptions = {},
): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw await errorFromResponse(method, url, response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
