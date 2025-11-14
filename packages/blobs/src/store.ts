import { getTracer, withActiveSpan } from '@netlify/otel'
import type { DeleteStoreResponse } from './backend/delete_store.ts'
import type { ListResponse, ListResponseBlob } from './backend/list.ts'
import { Client, type Conditions } from './client.ts'
import type { ConsistencyMode } from './consistency.ts'
import { getMetadataFromResponse, Metadata } from './metadata.ts'
import { BlobInput, HTTPMethod } from './types.ts'
import { BlobsInternalError, collectIterator } from './util.ts'

export const DEPLOY_STORE_PREFIX = 'deploy:'
export const LEGACY_STORE_INTERNAL_PREFIX = 'netlify-internal/legacy-namespace/'
export const SITE_STORE_PREFIX = 'site:'

const STATUS_OK = 200
const STATUS_PRE_CONDITION_FAILED = 412

interface BaseStoreOptions {
  client: Client
  consistency?: ConsistencyMode
}

interface DeployStoreOptions extends BaseStoreOptions {
  deployID: string
  name?: string
}

interface NamedStoreOptions extends BaseStoreOptions {
  name: string
}

export type StoreOptions = DeployStoreOptions | NamedStoreOptions

export interface GetOptions {
  consistency?: ConsistencyMode
}

export interface GetWithMetadataOptions {
  consistency?: ConsistencyMode
  etag?: string
}

export interface GetWithMetadataResult {
  etag?: string
  metadata: Metadata
}

export interface ListResult {
  blobs: ListResultBlob[]
  directories: string[]
}

export interface ListResultBlob {
  etag: string
  key: string
}

export interface ListOptions {
  directories?: boolean
  paginate?: boolean
  prefix?: string
}

export interface DeleteStoreResult {
  deletedBlobs: number
}

interface BaseSetOptions {
  /**
   * Arbitrary metadata object to associate with an entry. Must be seralizable
   * to JSON.
   */
  metadata?: Metadata
}

type CreateOnlyOptions = {
  onlyIfMatch?: never

  /**
   * If true, the operation will only succeed if the key does not already exist
   * in the store. If the key exists, the operation will return with
   * `modified: false`.
   */
  onlyIfNew?: boolean
}

type UpdateOnlyOptions = {
  /**
   * If specified, the operation will only succeed if the entry already exists
   * in the store and its current ETag matches this value. If it doesn't match,
   * the operation will return with `modified: false`.
   */
  onlyIfMatch?: string

  onlyIfNew?: never
}

export type SetOptions = BaseSetOptions & (CreateOnlyOptions | UpdateOnlyOptions)

export type WriteResult = {
  /**
   * The ETag of the entry after the write operation. It's only present if the
   * operation actually resulted in a modified entry.
   */
  etag?: string

  /**
   * A boolean indicating whether the operation has resulted in a modified
   * entry. A conditional `set` on a key that already exists will return
   * an object with `modified` set to false.
   */
  modified: boolean
}

export type BlobResponseType = 'arrayBuffer' | 'blob' | 'json' | 'stream' | 'text'

export class Store {
  private client: Client
  private name: string

  constructor(options: StoreOptions) {
    this.client = options.client

    if ('deployID' in options) {
      Store.validateDeployID(options.deployID)

      let name = DEPLOY_STORE_PREFIX + options.deployID

      if (options.name) {
        name += `:${options.name}`
      }

      this.name = name
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length)

      Store.validateStoreName(storeName)

      this.name = storeName
    } else {
      Store.validateStoreName(options.name)

      this.name = SITE_STORE_PREFIX + options.name
    }
  }

  async delete(key: string) {
    const res = await this.client.makeRequest({ key, method: HTTPMethod.DELETE, storeName: this.name })

    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res)
    }
  }

  async deleteAll(): Promise<DeleteStoreResult> {
    let totalDeletedBlobs = 0
    let hasMore = true

    while (hasMore) {
      const res = await this.client.makeRequest({ method: HTTPMethod.DELETE, storeName: this.name })

      if (res.status !== 200) {
        throw new BlobsInternalError(res)
      }

      const data = (await res.json()) as DeleteStoreResponse

      if (typeof data.blobs_deleted !== 'number') {
        throw new BlobsInternalError(res)
      }

      totalDeletedBlobs += data.blobs_deleted
      hasMore = typeof data.has_more === 'boolean' && data.has_more
    }

    return {
      deletedBlobs: totalDeletedBlobs,
    }
  }

  async get(key: string, options?: GetOptions & { type?: 'arrayBuffer' }): Promise<ArrayBuffer>
  async get(key: string, options?: GetOptions & { type?: 'blob' }): Promise<Blob>
  async get(key: string, options?: GetOptions & { type?: 'json' }): Promise<any>
  async get(key: string, options?: GetOptions & { type?: 'stream' }): Promise<ReadableStream>
  async get(key: string, options?: GetOptions & { type?: 'text' }): Promise<string>
  async get(key: string, options?: GetOptions): Promise<string | null>
  async get(
    key: string,
    options?: GetOptions & { type?: BlobResponseType },
  ): Promise<ArrayBuffer | Blob | ReadableStream | string | null> {
    return withActiveSpan(getTracer(), 'blobs.get', async (span) => {
      const { consistency, type } = options ?? {}

      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.key': key,
        'blobs.type': type,
        'blobs.method': 'GET',
        'blobs.consistency': consistency,
      })

      const res = await this.client.makeRequest({
        consistency,
        key,
        method: HTTPMethod.GET,
        storeName: this.name,
      })

      span?.setAttributes({
        'blobs.response.body.size': res.headers.get('content-length') ?? undefined,
        'blobs.response.status': res.status,
      })

      if (res.status === 404) {
        return null
      }

      if (res.status !== 200) {
        throw new BlobsInternalError(res)
      }

      if (type === undefined || type === 'text') {
        return res.text()
      }

      if (type === 'arrayBuffer') {
        return res.arrayBuffer()
      }

      if (type === 'blob') {
        return res.blob()
      }

      if (type === 'json') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return res.json()
      }

      if (type === 'stream') {
        return res.body
      }

      throw new BlobsInternalError(res)
    })
  }

  async getMetadata(key: string, { consistency }: { consistency?: ConsistencyMode } = {}) {
    return withActiveSpan(getTracer(), 'blobs.getMetadata', async (span) => {
      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.key': key,
        'blobs.method': 'HEAD',
        'blobs.consistency': consistency,
      })
      const res = await this.client.makeRequest({ consistency, key, method: HTTPMethod.HEAD, storeName: this.name })
      span?.setAttributes({
        'blobs.response.status': res.status,
      })

      if (res.status === 404) {
        return null
      }

      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res)
      }

      const etag = res?.headers.get('etag') ?? undefined
      const metadata = getMetadataFromResponse(res)
      const result = {
        etag,
        metadata,
      }

      return result
    })
  }

  async getWithMetadata(
    key: string,
    options?: GetWithMetadataOptions,
  ): Promise<({ data: string } & GetWithMetadataResult) | null>

  async getWithMetadata(
    key: string,
    options: { type: 'arrayBuffer' } & GetWithMetadataOptions,
  ): Promise<{ data: ArrayBuffer } & GetWithMetadataResult>

  async getWithMetadata(
    key: string,
    options: { type: 'blob' } & GetWithMetadataOptions,
  ): Promise<({ data: Blob } & GetWithMetadataResult) | null>

  async getWithMetadata(
    key: string,
    options: { type: 'json' } & GetWithMetadataOptions,
  ): Promise<({ data: any } & GetWithMetadataResult) | null>

  async getWithMetadata(
    key: string,
    options: { type: 'stream' } & GetWithMetadataOptions,
  ): Promise<({ data: ReadableStream } & GetWithMetadataResult) | null>

  async getWithMetadata(
    key: string,
    options: { type: 'text' } & GetWithMetadataOptions,
  ): Promise<({ data: string } & GetWithMetadataResult) | null>

  async getWithMetadata(
    key: string,
    options?: { type: BlobResponseType } & GetWithMetadataOptions,
  ): Promise<
    | ({
        data: ArrayBuffer | Blob | ReadableStream | string | null
      } & GetWithMetadataResult)
    | null
  > {
    return withActiveSpan(getTracer(), 'blobs.getWithMetadata', async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {}
      const headers = requestETag ? { 'if-none-match': requestETag } : undefined

      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.key': key,
        'blobs.method': 'GET',
        'blobs.consistency': options?.consistency,
        'blobs.type': type,
        'blobs.request.etag': requestETag,
      })

      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: HTTPMethod.GET,
        storeName: this.name,
      })
      const responseETag = res?.headers.get('etag') ?? undefined

      span?.setAttributes({
        'blobs.response.body.size': res.headers.get('content-length') ?? undefined,
        'blobs.response.etag': responseETag,
        'blobs.response.status': res.status,
      })

      if (res.status === 404) {
        return null
      }

      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res)
      }

      const metadata = getMetadataFromResponse(res)
      const result: GetWithMetadataResult = {
        etag: responseETag,
        metadata,
      }

      if (res.status === 304 && requestETag) {
        return { data: null, ...result }
      }

      if (type === undefined || type === 'text') {
        return { data: await res.text(), ...result }
      }

      if (type === 'arrayBuffer') {
        return { data: await res.arrayBuffer(), ...result }
      }

      if (type === 'blob') {
        return { data: await res.blob(), ...result }
      }

      if (type === 'json') {
        return { data: await res.json(), ...result }
      }

      if (type === 'stream') {
        return { data: res.body, ...result }
      }

      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`)
    })
  }

  list(options: ListOptions & { paginate: true }): AsyncIterable<ListResult>
  list(options?: ListOptions & { paginate?: false }): Promise<ListResult>
  list(options: ListOptions = {}): Promise<ListResult> | AsyncIterable<ListResult> {
    return withActiveSpan(getTracer(), 'blobs.list', (span) => {
      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.method': 'GET',
        'blobs.list.paginate': options.paginate ?? false,
      })

      const iterator = this.getListIterator(options)

      if (options.paginate) {
        return iterator
      }

      // We can't use `async/await` here because that would make the signature
      // incompatible with one of the overloads.
      return collectIterator(iterator).then((items) =>
        items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories],
          }),
          { blobs: [], directories: [] },
        ),
      )
    })
  }

  async set(key: string, data: BlobInput, options: SetOptions = {}): Promise<WriteResult> {
    return withActiveSpan(getTracer(), 'blobs.set', async (span) => {
      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.key': key,
        'blobs.method': 'PUT',
        'blobs.data.size': typeof data == 'string' ? data.length : data instanceof Blob ? data.size : data.byteLength,
        'blobs.data.type': typeof data == 'string' ? 'string' : data instanceof Blob ? 'blob' : 'arrayBuffer',
        'blobs.atomic': Boolean(options.onlyIfMatch ?? options.onlyIfNew),
      })

      Store.validateKey(key)

      const conditions = Store.getConditions(options)
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: HTTPMethod.PUT,
        storeName: this.name,
      })

      const etag = res.headers.get('etag') ?? ''

      span?.setAttributes({
        'blobs.response.etag': etag,
        'blobs.response.status': res.status,
      })

      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true }
      }

      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true,
        }
      }

      throw new BlobsInternalError(res)
    })
  }

  async setJSON(key: string, data: unknown, options: SetOptions = {}): Promise<WriteResult> {
    return withActiveSpan(getTracer(), 'blobs.setJSON', async (span) => {
      span?.setAttributes({
        'blobs.store': this.name,
        'blobs.key': key,
        'blobs.method': 'PUT',
        'blobs.data.type': 'json',
      })
      Store.validateKey(key)

      const conditions = Store.getConditions(options)
      const payload = JSON.stringify(data)
      const headers = {
        'content-type': 'application/json',
      }

      const res = await this.client.makeRequest({
        ...conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: HTTPMethod.PUT,
        storeName: this.name,
      })

      const etag = res.headers.get('etag') ?? ''
      span?.setAttributes({
        'blobs.response.etag': etag,
        'blobs.response.status': res.status,
      })

      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true }
      }

      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true,
        }
      }

      throw new BlobsInternalError(res)
    })
  }

  private static formatListResultBlob(result: ListResponseBlob): ListResultBlob | null {
    if (!result.key) {
      return null
    }

    return {
      etag: result.etag,
      key: result.key,
    }
  }

  private static getConditions(options: SetOptions): Conditions | undefined {
    if ('onlyIfMatch' in options && 'onlyIfNew' in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`,
      )
    }

    if ('onlyIfMatch' in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== 'string') {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`)
      }

      return {
        onlyIfMatch: options.onlyIfMatch,
      }
    }

    if ('onlyIfNew' in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== 'boolean') {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`,
        )
      }

      return {
        onlyIfNew: true,
      }
    }
  }

  private static validateKey(key: string) {
    if (key === '') {
      throw new Error('Blob key must not be empty.')
    }

    if (key.startsWith('/') || key.startsWith('%2F')) {
      throw new Error('Blob key must not start with forward slash (/).')
    }

    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        'Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long.',
      )
    }
  }

  private static validateDeployID(deployID: string) {
    // We could be stricter here and require a length of 24 characters, but the
    // CLI currently uses a deploy of `0` when running Netlify Dev, since there
    // is no actual deploy at that point. Let's go with a more loose validation
    // logic here until we update the CLI.
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`)
    }
  }

  private static validateStoreName(name: string) {
    if (name.includes('/') || name.includes('%2F')) {
      throw new Error('Store name must not contain forward slashes (/).')
    }

    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        'Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long.',
      )
    }
  }

  private getListIterator(options?: ListOptions): AsyncIterable<ListResult> {
    const { client, name: storeName } = this
    const parameters: Record<string, string> = {}

    if (options?.prefix) {
      parameters.prefix = options.prefix
    }

    if (options?.directories) {
      parameters.directories = 'true'
    }

    return {
      [Symbol.asyncIterator]() {
        let currentCursor: string | null = null
        let done = false

        return {
          async next() {
            return withActiveSpan(getTracer(), 'blobs.list.next', async (span) => {
              span?.setAttributes({
                'blobs.store': storeName,
                'blobs.method': 'GET',
                'blobs.list.paginate': options?.paginate ?? false,
                'blobs.list.done': done,
                'blobs.list.cursor': currentCursor ?? undefined,
              })
              if (done) {
                return { done: true, value: undefined } as const
              }

              const nextParameters = { ...parameters }

              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor
              }

              const res = await client.makeRequest({
                method: HTTPMethod.GET,
                parameters: nextParameters,
                storeName,
              })

              span?.setAttributes({
                'blobs.response.status': res.status,
              })

              let blobs: ListResponseBlob[] = []
              let directories: string[] = []

              if (![200, 204, 404].includes(res.status)) {
                throw new BlobsInternalError(res)
              }

              if (res.status === 404) {
                done = true
              } else {
                const page = (await res.json()) as ListResponse

                if (page.next_cursor) {
                  currentCursor = page.next_cursor
                } else {
                  done = true
                }

                blobs = (page.blobs ?? []).map(Store.formatListResultBlob).filter(Boolean) as ListResponseBlob[]
                directories = page.directories ?? []
              }

              return {
                done: false,
                value: {
                  blobs,
                  directories,
                },
              }
            })
          },
        }
      },
    }
  }
}
