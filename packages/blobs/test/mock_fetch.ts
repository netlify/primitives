import { expect } from 'vitest'

type BodyFunction = (req: BodyInit | null | undefined) => void

interface ExpectedRequest {
  body?: string | BodyFunction
  fulfilled: boolean
  headers: Record<string, string>
  method: string
  response: Response | Error
  url: string
}

interface ExpectedRequestOptions {
  body?: string | BodyFunction
  headers?: Record<string, string>
  response: Response | Error
  url: string
}

export class MockFetch {
  requests: ExpectedRequest[]

  constructor() {
    this.requests = []
  }

  private addExpectedRequest({
    body,
    headers = {},
    method,
    response,
    url,
  }: ExpectedRequestOptions & { method: string }) {
    this.requests.push({ body, fulfilled: false, headers, method, response, url })

    return this
  }

  delete(options: ExpectedRequestOptions) {
    return this.addExpectedRequest({ ...options, method: 'delete' })
  }

  get(options: ExpectedRequestOptions) {
    return this.addExpectedRequest({ ...options, method: 'get' })
  }

  head(options: ExpectedRequestOptions) {
    return this.addExpectedRequest({ ...options, method: 'head' })
  }

  post(options: ExpectedRequestOptions) {
    return this.addExpectedRequest({ ...options, method: 'post' })
  }

  put(options: ExpectedRequestOptions) {
    return this.addExpectedRequest({ ...options, method: 'put' })
  }

  get fetch() {
    // eslint-disable-next-line require-await
    return async (...args: Parameters<typeof globalThis.fetch>) => {
      const [url, options] = args
      const method = options?.method ?? 'get'
      const headers = options?.headers as Record<string, string>
      const urlString = url.toString()
      const match = this.requests.find(
        (request) => request.method === options?.method && request.url === urlString && !request.fulfilled,
      )

      if (!match) {
        throw new Error(`Unexpected fetch call: ${method} ${url}`)
      }

      for (const key in match.headers) {
        expect(headers[key]).toBe(match.headers[key])
      }

      if (typeof match.body === 'string') {
        expect(options?.body).toBe(match.body)
      } else if (typeof match.body === 'function') {
        const bodyFn = match.body

        expect(() => bodyFn(options?.body)).not.toThrow()
      } else {
        expect(options?.body).toBeUndefined()
      }

      match.fulfilled = true

      if (match.response instanceof Error) {
        throw match.response
      }

      return match.response
    }
  }

  get fulfilled() {
    return this.requests.every((request) => request.fulfilled)
  }
}
