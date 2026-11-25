import { errorFromResponse } from './error.js'

export interface RequestOptions {
  body?: unknown
  method?: string
  signal?: AbortSignal
}

/** Sends a request to the API running inside a sandbox. */
export type SandboxRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

export interface RawRequestOptions {
  body?: BodyInit
  headers?: Record<string, string>
  method?: string
  signal?: AbortSignal
}

/** Sends a request to the API running inside a sandbox and resolves with the raw response. */
export type SandboxRawRequest = (path: string, options?: RawRequestOptions) => Promise<Response>

/**
 * Sends an authenticated request and resolves with the response. Rejects with
 * a `SandboxError` when the request fails.
 */
export const send = async (
  fetch: typeof globalThis.fetch,
  url: string,
  token: string,
  { body, headers, method = 'GET', signal }: RawRequestOptions = {},
): Promise<Response> => {
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: { ...headers, authorization: `Bearer ${token}` },
    body,
    signal,
  }

  // A body that is a stream is sent as it is read, which fetch only does when
  // asked.
  if (body instanceof ReadableStream) {
    init.duplex = 'half'
  }

  const response = await fetch(url, init)

  if (!response.ok) {
    throw await errorFromResponse(method, url, response)
  }

  return response
}

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
  const response = await send(fetch, url, token, {
    method,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  const text = await response.text()

  return (text === '' ? undefined : JSON.parse(text)) as T
}
