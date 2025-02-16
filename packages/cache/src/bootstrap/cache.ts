import type { Base64Encoder, EnvironmentOptions, Factory } from './environment.js'

import * as HEADERS from '../headers.js'

const allowedProtocols = new Set(['http:', 'https:'])

// These headers will be discarded from any cached resource and will not be
// sent to the API.
const discardedHeaders = new Set(['cookie', 'content-encoding', 'content-length'])

type NetlifyCacheOptions = EnvironmentOptions & {
  name: string
}

const getInternalHeaders = Symbol('getInternalHeaders')
const serializeResourceHeaders = Symbol('serializeResourceHeaders')

export class NetlifyCache implements Cache {
  #base64Encode: Base64Encoder
  #getHost?: Factory<string>
  #getToken: Factory<string>
  #getURL: Factory<string>
  #name: string
  #userAgent?: string

  constructor({ base64Encode, getHost, getToken, getURL, name, userAgent }: NetlifyCacheOptions) {
    this.#base64Encode = base64Encode
    this.#getHost = getHost
    this.#getToken = getToken
    this.#getURL = getURL
    this.#name = name
    this.#userAgent = userAgent
  }

  private [getInternalHeaders]() {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#getToken()}`,
      [HEADERS.ResourceStore]: this.#name,
    }

    const host = this.#getHost?.()
    if (host) {
      headers[HEADERS.NetlifyForwardedHost] = host
    }

    if (this.#userAgent) {
      headers[HEADERS.UserAgent] = this.#userAgent
    }

    return headers
  }

  private [serializeResourceHeaders](headers: Headers) {
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

    return this.#base64Encode(JSON.stringify(headersMap))
  }

  async add(request: RequestInfo): Promise<void> {
    await this.put(new Request(request), await fetch(request))
  }

  async addAll(requests: RequestInfo[]): Promise<void> {
    await Promise.allSettled(requests.map((request) => this.add(request)))
  }

  // eslint-disable-next-line class-methods-use-this, require-await, @typescript-eslint/no-unused-vars
  async delete(request: RequestInfo) {
    const resourceURL = extractAndValidateURL(request)

    await fetch(`${this.#getURL()}/${toCacheKey(resourceURL)}`, {
      headers: this[getInternalHeaders](),
      method: 'DELETE',
    })

    return true
  }

  // eslint-disable-next-line class-methods-use-this, require-await, @typescript-eslint/no-unused-vars
  async keys(_request?: Request) {
    // Not implemented.
    return []
  }

  async match(request: RequestInfo) {
    try {
      const resourceURL = extractAndValidateURL(request)
      const cacheURL = `${this.#getURL()}/${toCacheKey(resourceURL)}`
      const response = await fetch(cacheURL, {
        headers: this[getInternalHeaders](),
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

    await fetch(`${this.#getURL()}/${toCacheKey(resourceURL)}`, {
      body: response.body,
      headers: {
        ...this[getInternalHeaders](),
        [HEADERS.ResourceHeaders]: this[serializeResourceHeaders](response.headers),
        [HEADERS.ResourceStatus]: response.status.toString(),
      },
      // @ts-expect-error https://github.com/whatwg/fetch/pull/1457
      duplex: 'half',
      method: 'POST',
    })
  }
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
