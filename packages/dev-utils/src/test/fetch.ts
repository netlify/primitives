import assert from 'node:assert'
import { Readable } from 'node:stream'
import { ReadableStream } from 'node:stream/web'

type BodyFunction = (bufferedBody: string | null) => Promise<void> | void
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

      if (match.body !== undefined) {
        let requestBody: string | null = null

        if (options?.body) {
          if (typeof options.body === 'string') {
            requestBody = options.body
          } else {
            requestBody = await readAsString(Readable.fromWeb(options.body as ReadableStream<any>))
          }
        }

        if (typeof match.body === 'string') {
          assert.equal(requestBody, match.body)
        } else if (typeof match.body === 'function') {
          const bodyFn = match.body

          assert.doesNotThrow(() => bodyFn(requestBody))
        } else if (match.body === null) {
          assert.equal(options?.body, undefined)
        }
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

export const readAsString = (input: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    let buffer = ''

    input.on('data', (chunk) => {
      buffer += chunk
    })

    input.on('error', (error) => {
      reject(error)
    })

    input.on('end', () => {
      resolve(buffer)
    })
  })
