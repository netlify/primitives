import { Buffer } from 'node:buffer'

import type { TokenFactory } from './environment.js'

const HEADERS_HEADER = 'Netlify-Programmable-Headers'
const STATUS_HEADER = 'Netlify-Programmable-Status'
const STORE_HEADER = 'Netlify-Programmable-Store'

const allowedProtocols = new Set(['http:', 'https:'])

// These headers will be discarded from any cached resource and will not be
// sent to the API.
const discardedHeaders = new Set(['cookie', 'content-encoding', 'content-length'])

interface NetlifyCacheOptions {
  getToken: TokenFactory
  name: string
  url: string
}

export class NetlifyCache implements Cache {
  #getToken: TokenFactory
  #name: string
  #url: string

  constructor({ getToken, name, url }: NetlifyCacheOptions) {
    this.#getToken = getToken
    this.#name = name
    this.#url = url
  }

  async add(request: RequestInfo): Promise<void> {
    await this.put(new Request(request), await fetch(request))
  }

  async addAll(requests: RequestInfo[]): Promise<void> {
    await Promise.allSettled(requests.map((request) => this.add(request)))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async matchAll(request?: RequestInfo, _options?: CacheQueryOptions): Promise<readonly Response[]> {
    if (!request) {
      return []
    }

    const res = await this.match(request)

    return res ? [res] : []
  }

  async put(request: RequestInfo | URL | string, response: Response) {
    if (!response.ok) {
      throw new TypeError(`Cannot cache response with status ${response.status}.`)
    }

    if (request instanceof Request && request.method !== 'GET') {
      throw new TypeError(`Cannot cache response to ${request.method} request.`)
    }

    if (response.status === 206) {
      throw new TypeError('Cannot cache response to a range request (206 Partial Content).')
    }

    if (response.headers.get('vary')?.includes('*')) {
      throw new TypeError("Cannot cache response with 'Vary: *' header.")
    }

    const resourceURL = extractAndValidateURL(request)

    await fetch(`${this.#url}/${toCacheKey(resourceURL)}`, {
      body: response.body,
      headers: {
        Authorization: `Bearer ${this.#getToken()}`,
        [HEADERS_HEADER]: getEncodedHeaders(response.headers),
        [STATUS_HEADER]: response.status.toString(),
        [STORE_HEADER]: this.#name,
      },
      // @ts-expect-error https://github.com/whatwg/fetch/pull/1457
      duplex: 'half',
      method: 'POST',
    })
  }

  async match(request: RequestInfo) {
    try {
      const resourceURL = extractAndValidateURL(request)
      const cacheURL = `${this.#url}/${toCacheKey(resourceURL)}`
      const response = await fetch(cacheURL, {
        headers: {
          Authorization: `Bearer ${this.#getToken()}`,
        },
        method: 'GET',
      })

      if (!response.ok) {
        return
      }

      return response
    } catch {
      // no-op
    }
  }

  // eslint-disable-next-line class-methods-use-this, require-await, @typescript-eslint/no-unused-vars
  async delete(request: RequestInfo) {
    const resourceURL = extractAndValidateURL(request)

    await fetch(`${this.#url}/${toCacheKey(resourceURL)}`, {
      headers: {
        Authorization: `Bearer ${this.#getToken()}`,
        [STORE_HEADER]: this.#name,
      },
      method: 'DELETE',
    })

    return true
  }

  // eslint-disable-next-line class-methods-use-this, require-await, @typescript-eslint/no-unused-vars
  async keys(_request?: Request) {
    // Not implemented.
    return []
  }
}

const getEncodedHeaders = (headers: Headers) => {
  const headersMap: Record<string, string[]> = {}

  headers.forEach((value, key) => {
    if (discardedHeaders.has(key)) {
      return
    }

    // When there are multiple values for the same header, the `value` argument
    // will have them as a comma-separated list. The exception is `set-cookie`,
    // where the callback fires multiple times, each with a different `value`.
    if (key === 'set-cookie') {
      headersMap[key] = headersMap[key] || []
      headersMap[key].push(value)
    } else {
      headersMap[key] = value.split(',')
    }
  })

  return Buffer.from(JSON.stringify(headersMap), 'utf8').toString('base64')
}

const extractAndValidateURL = (input: RequestInfo | URL): URL => {
  let url: URL

  if (input instanceof Request) {
    url = new URL(input.url)
  } else {
    try {
      url = new URL(String(input))
    } catch {
      throw new TypeError(`${input} is not a valid URL.`)
    }
  }

  if (!allowedProtocols.has(url.protocol)) {
    throw new TypeError(
      `Cannot cache response for URL with unsupported protocol (${url.protocol}). Supported protocols are ${[
        ...allowedProtocols,
      ].join(', ')}.`,
    )
  }

  return url
}

const toCacheKey = (url: URL) => encodeURIComponent(url.toString())
