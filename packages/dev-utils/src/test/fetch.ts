import assert from 'node:assert'

type BodyFunction = (req: BodyInit | null | undefined) => Promise<void> | void
type HeadersFunction = (headers: Record<string, string>) => Promise<void> | void
type ResponseFunction = () => Promise<Response> | Response

interface ExpectedRequest {
  body?: string | BodyFunction
  fulfilled: boolean
  headers: Record<string, string> | HeadersFunction
  method: string
  response: Response | ResponseFunction | Error
  url: string
}

interface ExpectedRequestOptions {
  body?: string | BodyFunction
  headers?: Record<string, string> | HeadersFunction
  response: Response | ResponseFunction | Error
  url: string
}

export class MockFetch {
  originalFetch: typeof globalThis.fetch
  requests: ExpectedRequest[]

  constructor() {
    this.originalFetch = globalThis.fetch
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
      const [reqOrURL, options] = args
      const url = (reqOrURL instanceof Request ? reqOrURL.url : reqOrURL).toString()
      const method = options?.method ?? 'get'
      const headers = options?.headers as Record<string, string>
      const match = this.requests.find(
        (request) => request.method.toLowerCase() === method.toLowerCase() && request.url === url && !request.fulfilled,
      )

      if (!match) {
        throw new Error(`Unexpected fetch call: ${method} ${url}`)
      }

      if (typeof match.headers === 'function') {
        assert.doesNotThrow(() => (match.headers as HeadersFunction)(headers))
      } else {
        for (const key in match.headers) {
          assert.equal(headers[key], match.headers[key])
        }
      }

      if (typeof match.body === 'string') {
        assert.equal(options?.body, match.body)
      } else if (typeof match.body === 'function') {
        const bodyFn = match.body

        assert.doesNotThrow(() => bodyFn(options?.body))
      } else if (match.body === null) {
        assert.equal(options?.body, undefined)
      }

      match.fulfilled = true

      if (match.response instanceof Error) {
        throw match.response
      }

      if (typeof match.response === 'function') {
        return match.response()
      }

      return match.response
    }
  }

  get fulfilled() {
    return this.requests.every((request) => request.fulfilled)
  }

  inject() {
    globalThis.fetch = this.fetch

    return this
  }

  restore() {
    globalThis.fetch = this.originalFetch
  }
}
