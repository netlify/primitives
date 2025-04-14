import { BlobsConsistencyError, ConsistencyMode } from './consistency.ts'
import { EnvironmentContext, getEnvironmentContext, MissingBlobsEnvironmentError } from './environment.ts'
import { encodeMetadata, Metadata, METADATA_HEADER_EXTERNAL, METADATA_HEADER_INTERNAL } from './metadata.ts'
import { InvalidBlobsRegionError, isValidRegion } from './region.ts'
import { fetchAndRetry } from './retry.ts'
import { BlobInput, Fetcher, HTTPMethod } from './types.ts'
import { BlobsInternalError } from './util.ts'

export const SIGNED_URL_ACCEPT_HEADER = 'application/json;type=signed-url'

interface MakeStoreRequestOptions {
  body?: BlobInput | null
  consistency?: ConsistencyMode
  headers?: Record<string, string>
  key?: string
  metadata?: Metadata
  method: HTTPMethod
  parameters?: Record<string, string>
  storeName?: string
}

export interface ClientOptions {
  apiURL?: string
  consistency?: ConsistencyMode
  edgeURL?: string
  fetch?: Fetcher
  siteID: string
  token: string
  uncachedEdgeURL?: string
}

interface InternalClientOptions extends ClientOptions {
  region?: string
}

interface GetFinalRequestOptions {
  consistency?: ConsistencyMode
  key: string | undefined
  metadata?: Metadata
  method: string
  parameters?: Record<string, string>
  storeName?: string
}

export class Client {
  private apiURL?: string
  private consistency: ConsistencyMode
  private edgeURL?: string
  private fetch: Fetcher
  private region?: string
  private siteID: string
  private token: string
  private uncachedEdgeURL?: string

  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }: InternalClientOptions) {
    this.apiURL = apiURL
    this.consistency = consistency ?? 'eventual'
    this.edgeURL = edgeURL
    this.fetch = fetch ?? globalThis.fetch
    this.region = region
    this.siteID = siteID
    this.token = token
    this.uncachedEdgeURL = uncachedEdgeURL

    if (!this.fetch) {
      throw new Error(
        'Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property.',
      )
    }
  }

  private async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName,
  }: GetFinalRequestOptions) {
    const encodedMetadata = encodeMetadata(metadata)
    const consistency = opConsistency ?? this.consistency

    let urlPath = `/${this.siteID}`

    if (storeName) {
      urlPath += `/${storeName}`
    }

    if (key) {
      urlPath += `/${key}`
    }

    if (this.edgeURL) {
      if (consistency === 'strong' && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError()
      }

      const headers: Record<string, string> = {
        authorization: `Bearer ${this.token}`,
      }

      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata
      }

      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`
      }

      const url = new URL(urlPath, consistency === 'strong' ? this.uncachedEdgeURL : this.edgeURL)

      for (const key in parameters) {
        url.searchParams.set(key, parameters[key])
      }

      return {
        headers,
        url: url.toString(),
      }
    }

    const apiHeaders: Record<string, string> = { authorization: `Bearer ${this.token}` }
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? 'https://api.netlify.com')

    for (const key in parameters) {
      url.searchParams.set(key, parameters[key])
    }

    if (this.region) {
      url.searchParams.set('region', this.region)
    }

    // If there is no store name, we're listing stores. If there's no key,
    // we're listing blobs. Both operations are implemented directly in the
    // Netlify API.
    if (storeName === undefined || key === undefined) {
      return {
        headers: apiHeaders,
        url: url.toString(),
      }
    }

    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata
    }

    // HEAD and DELETE requests are implemented directly in the Netlify API.
    if (method === HTTPMethod.HEAD || method === HTTPMethod.DELETE) {
      return {
        headers: apiHeaders,
        url: url.toString(),
      }
    }

    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method,
    })

    if (res.status !== 200) {
      throw new BlobsInternalError(res)
    }

    const { url: signedURL } = await res.json()
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : undefined

    return {
      headers: userHeaders,
      url: signedURL,
    }
  }

  async makeRequest({
    body,
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName,
  }: MakeStoreRequestOptions) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName,
    })
    const headers: Record<string, string> = {
      ...baseHeaders,
      ...extraHeaders,
    }

    if (method === HTTPMethod.PUT) {
      headers['cache-control'] = 'max-age=0, stale-while-revalidate=60'
    }

    const options: RequestInit = {
      body,
      headers,
      method,
    }

    if (body instanceof ReadableStream) {
      // @ts-expect-error Part of the spec, but not typed:
      // https://fetch.spec.whatwg.org/#enumdef-requestduplex
      options.duplex = 'half'
    }

    return fetchAndRetry(this.fetch, url, options)
  }
}

/**
 * Merges a set of options supplied by the user when getting a reference to a
 * store with a context object found in the environment.
 *
 * @param options User-supplied options
 * @param contextOverride Context to be used instead of the environment object
 */
export const getClientOptions = (
  options: Partial<InternalClientOptions>,
  contextOverride?: EnvironmentContext,
): InternalClientOptions => {
  const context = contextOverride ?? getEnvironmentContext()
  const siteID = context.siteID ?? options.siteID
  const token = context.token ?? options.token

  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(['siteID', 'token'])
  }

  if (options.region !== undefined && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region)
  }

  const clientOptions: InternalClientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL,
  }

  return clientOptions
}
