import { errorFromResponse } from './error.js'

export interface RequestOptions {
  body?: unknown
  method?: string
  signal?: AbortSignal
}

/** Sends a request to a sandbox's own API. */
export type SandboxRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

/**
 * Sends an authenticated JSON request and resolves with the parsed response
 * body, or with `undefined` when the response has no body. Rejects with a
 * `SandboxError` when the request fails.
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

  const text = await response.text()

  return (text === '' ? undefined : JSON.parse(text)) as T
}
