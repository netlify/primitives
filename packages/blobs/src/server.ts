import { createHash, createHmac } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { HTTPServer } from '@netlify/dev-utils'

import { ListResponse } from './backend/list.ts'
import { SIGNED_URL_ACCEPT_HEADER } from './client.ts'
import { decodeMetadata, encodeMetadata, METADATA_HEADER_INTERNAL } from './metadata.ts'
import { HTTPMethod } from './types.ts'
import { decodeName, encodeName, isNodeError, Logger } from './util.ts'

const API_URL_PATH = /\/api\/v1\/blobs\/(?<site_id>[^/]+)\/(?<store_name>[^/]+)\/?(?<key>[^?]*)/
const LEGACY_API_URL_PATH = /\/api\/v1\/sites\/(?<site_id>[^/]+)\/blobs\/?(?<key>[^?]*)/
const LEGACY_DEFAULT_STORE = 'production'
const REGION_PREFIX = 'region:'

export enum Operation {
  DELETE = 'delete',
  GET = 'get',
  GET_METADATA = 'getMetadata',
  LIST = 'list',
  SET = 'set',
}

export type OnRequestCallback = (parameters: { type: Operation; url: string }) => void

interface BlobsServerOptions {
  /**
   * Whether debug-level information should be logged, such as internal errors
   * or information about incoming requests.
   */
  debug?: boolean

  /**
   * Base directory to read and write files from.
   */
  directory: string

  /**
   * Function to log messages. Defaults to `console.log`.
   */
  logger?: Logger

  /**
   * Callback function to be called on every request.
   */
  onRequest?: OnRequestCallback

  /**
   * Port to run the server on. Defaults to a random port.
   */
  port?: number

  /**
   * Static authentication token that should be present in all requests. If not
   * supplied, no authentication check is performed.
   */
  token?: string
}

export class BlobsServer {
  private address: string
  private debug: boolean
  private directory: string
  private logger: Logger
  private onRequest?: OnRequestCallback
  private port?: number
  private server?: InstanceType<typeof HTTPServer>
  private token?: string
  private tokenHash: string

  constructor({ debug, directory, logger, onRequest, port, token }: BlobsServerOptions) {
    this.address = ''
    this.port = port
    this.debug = debug === true
    this.directory = directory
    this.logger = logger ?? console.log
    this.onRequest = onRequest
    this.token = token
    this.tokenHash = createHmac('sha256', Math.random.toString())
      .update(token ?? Math.random.toString())
      .digest('hex')
  }

  private dispatchOnRequestEvent(type: Operation, input: string | URL) {
    if (!this.onRequest) {
      return
    }

    const url = new URL(input)

    this.onRequest({ type, url: url.pathname + url.search })
  }

  private async delete(req: Request): Promise<Response> {
    const apiMatch = this.parseAPIRequest(req)

    if (apiMatch?.useSignedURL) {
      return Response.json({ url: apiMatch.url.toString() })
    }

    const url = new URL(apiMatch?.url ?? req.url ?? '', this.address)
    const { dataPath, key, metadataPath, rootPath } = this.getLocalPaths(url)

    if (!dataPath || !rootPath) {
      return new Response(null, { status: 400 })
    }

    // If there's no key, we're deleting all blobs from the store.
    if (!key) {
      return this.deleteAll(rootPath)
    }

    // Try to delete the metadata file, if one exists.
    try {
      await fs.rm(metadataPath, { force: true, recursive: true })
    } catch {
      // no-op
    }

    // Delete the data file.
    try {
      await fs.rm(dataPath, { force: true, recursive: true })
    } catch (error: unknown) {
      // An `ENOENT` error means we have tried to delete a key that doesn't
      // exist, which shouldn't be treated as an error.
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        return new Response(null, { status: 500 })
      }
    }

    return new Response(null, { status: 204 })
  }

  private async deleteAll(rootPath: string): Promise<Response> {
    let blobsDeleted = 0

    try {
      // Count the number of blobs before deleting.
      try {
        const countResult: ListResponse = {
          blobs: [],
          directories: [],
        }

        await BlobsServer.walk({
          directories: false,
          path: rootPath,
          prefix: '',
          rootPath,
          result: countResult,
        })

        blobsDeleted = countResult.blobs?.length ?? 0
      } catch (error: unknown) {
        // If the directory doesn't exist, there are no blobs to delete.
        if (!isNodeError(error) || error.code !== 'ENOENT') {
          throw error
        }
      }

      // Delete all data files in the store.
      await fs.rm(rootPath, { force: true, recursive: true })

      // Extract site ID and store name from rootPath to delete metadata.
      const pathParts = rootPath.split(sep)
      const storeName = pathParts[pathParts.length - 1]
      const siteID = pathParts[pathParts.length - 2]
      const metadataStorePath = resolve(this.directory, 'metadata', siteID, storeName)

      // Delete all metadata files in the store.
      await fs.rm(metadataStorePath, { force: true, recursive: true })
    } catch (error: unknown) {
      // An `ENOENT` error means the store doesn't exist, which is acceptable.
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        this.logDebug('Error when deleting store:', error)

        return new Response(null, { status: 500 })
      }
    }

    return Response.json({ blobs_deleted: blobsDeleted, has_more: false })
  }

  private async get(req: Request): Promise<Response> {
    const apiMatch = this.parseAPIRequest(req)
    const url = apiMatch?.url ?? new URL(req.url ?? '', this.address)

    if (apiMatch?.key && apiMatch?.useSignedURL) {
      return Response.json({ url: apiMatch.url.toString() })
    }

    const { dataPath, key, metadataPath, rootPath } = this.getLocalPaths(apiMatch?.url ?? url)

    // If there's no root path, the request is invalid.
    if (!rootPath) {
      return new Response(null, { status: 400 })
    }

    // If there's no data or metadata paths, it means we're listing stores.
    if (!dataPath || !metadataPath) {
      return this.listStores(rootPath, url.searchParams.get('prefix') ?? '')
    }

    // If there is no key in the URL, it means we're listing blobs.
    if (!key) {
      return this.listBlobs({ dataPath, metadataPath, rootPath, req, url })
    }

    this.dispatchOnRequestEvent(Operation.GET, url)

    const etag = await BlobsServer.generateETag(dataPath)

    if (!etag) {
      return new Response(null, { status: 404 })
    }

    if (BlobsServer.matchesETag(req.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers: { etag } })
    }

    const headers: Record<string, string> = { etag, ...(await this.readMetadataHeaders(metadataPath)) }

    try {
      const fileStream = createReadStream(dataPath)
      const chunks: Buffer[] = []

      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk))
      }

      const buffer = Buffer.concat(chunks)

      return new Response(buffer, { headers })
    } catch (error) {
      if (isNodeError(error) && (error.code === 'EISDIR' || error.code === 'ENOENT')) {
        return new Response(null, { status: 404 })
      }

      this.logDebug('Error when reading data:', error)

      return new Response(null, { status: 500 })
    }
  }

  private async head(req: Request): Promise<Response> {
    const url = this.parseAPIRequest(req)?.url ?? new URL(req.url ?? '', this.address)
    const { dataPath, key, metadataPath } = this.getLocalPaths(url)

    if (!dataPath || !metadataPath || !key) {
      return new Response(null, { status: 400 })
    }

    const etag = await BlobsServer.generateETag(dataPath)

    if (!etag) {
      return new Response(null, { status: 404 })
    }

    if (BlobsServer.matchesETag(req.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers: { etag } })
    }

    return new Response(null, {
      headers: { etag, ...(await this.readMetadataHeaders(metadataPath)) },
    })
  }

  private async readMetadataHeaders(metadataPath: string): Promise<Record<string, string>> {
    try {
      const rawData = await fs.readFile(metadataPath, 'utf8')
      const encodedMetadata = encodeMetadata(JSON.parse(rawData))

      return encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : {}
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        this.logDebug('Could not read metadata file:', error)
      }

      return {}
    }
  }

  /**
   * Whether an `If-None-Match` header matches the current entity.
   */
  private static matchesETag(header: string | null, etag: string) {
    if (!header) {
      return false
    }

    return header
      .split(',')
      .map((tag) => tag.trim())
      .some((tag) => tag === '*' || tag === etag)
  }

  private async listBlobs(options: {
    dataPath: string
    metadataPath: string
    rootPath: string
    req: Request
    url: URL
  }): Promise<Response> {
    const { dataPath, rootPath, url } = options
    const directories = url.searchParams.get('directories') === 'true'
    const prefix = url.searchParams.get('prefix') ?? ''
    const result: ListResponse = {
      blobs: [],
      directories: [],
    }

    this.dispatchOnRequestEvent(Operation.LIST, url)

    try {
      await BlobsServer.walk({ directories, path: dataPath, prefix, rootPath, result })
    } catch (error) {
      // If the directory is not found, it just means there are no entries on
      // the store, so that shouldn't be treated as an error.
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        this.logDebug('Could not perform list:', error)

        return new Response(null, { status: 500 })
      }
    }

    // Keys are listed in UTF-8 byte order, and directories keep their trailing
    // slash, as in production.
    result.blobs?.sort((a, b) => compareKeys(a.key, b.key))
    result.directories?.sort(compareKeys)

    return Response.json(result)
  }

  private async listStores(rootPath: string, prefix: string): Promise<Response> {
    try {
      const allStores = await fs.readdir(rootPath)
      const stores: string[] = []

      for (const entry of allStores) {
        const store = decodeName(entry)

        // A store is a prefix of its keys, so one without blobs does not exist.
        if (store.startsWith(prefix) && (await BlobsServer.hasFiles(join(rootPath, entry)))) {
          stores.push(store)
        }
      }

      return Response.json({ stores: stores.sort(compareKeys) })
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return Response.json({ stores: [] })
      }

      this.logDebug('Could not list stores:', error)

      return new Response(null, { status: 500 })
    }
  }

  private logDebug(...message: unknown[]) {
    if (!this.debug) {
      return
    }

    this.logger('[Netlify Blobs server]', ...message)
  }

  private async put(req: Request): Promise<Response> {
    const apiMatch = this.parseAPIRequest(req)
    if (apiMatch) {
      return Response.json({ url: apiMatch.url.toString() })
    }

    const url = new URL(req.url ?? '', this.address)
    const { dataPath, key, metadataPath } = this.getLocalPaths(url)

    if (!dataPath || !key || !metadataPath) {
      return new Response(null, { status: 400 })
    }

    // Check conditional write headers.
    const ifMatch = req.headers.get('if-match')
    const ifNoneMatch = req.headers.get('if-none-match')

    try {
      let fileExists = false
      try {
        await fs.access(dataPath)

        fileExists = true
      } catch {}

      const currentEtag = fileExists ? await BlobsServer.generateETag(dataPath) : undefined

      if (ifNoneMatch === '*' && fileExists) {
        return new Response(null, { status: 412 })
      }

      // A write conditioned on the ETag of a missing key is a 404 in production.
      if (ifMatch && !fileExists) {
        return new Response(null, { status: 404 })
      }

      if (ifMatch && ifMatch !== currentEtag) {
        return new Response(null, { status: 412 })
      }

      const metadataHeader = req.headers.get(METADATA_HEADER_INTERNAL)
      const metadata = decodeMetadata(metadataHeader)

      // We can't have multiple requests writing to the same file, which could
      // happen if multiple clients try to write to the same key at the same
      // time. To prevent this, we write to a temporary file first and then
      // atomically move it to its final destination.
      const tempPath = join(dirname(dataPath), `.${Math.random().toString(36).slice(2)}`)
      const body = await req.arrayBuffer()
      await fs.mkdir(dirname(dataPath), { recursive: true })
      await fs.writeFile(tempPath, Buffer.from(body))
      await fs.rename(tempPath, dataPath)

      // A write replaces the whole object, metadata included.
      if (metadata && Object.keys(metadata).length !== 0) {
        await fs.mkdir(dirname(metadataPath), { recursive: true })
        await fs.writeFile(metadataPath, JSON.stringify(metadata))
      } else {
        await fs.rm(metadataPath, { force: true })
      }

      const newEtag = await BlobsServer.generateETag(dataPath)

      return new Response(null, {
        status: 200,
        headers: {
          etag: newEtag,
        },
      })
    } catch (error) {
      if (isNodeError(error)) {
        this.logDebug('Error when writing data:', error)
      }
      return new Response(null, { status: 500 })
    }
  }

  /**
   * Parses the URL and returns the filesystem paths where entries and metadata
   * should be stored.
   */
  private getLocalPaths(url?: URL) {
    if (!url) {
      return {}
    }

    let parts = url.pathname.split('/').slice(1)

    if (parts[0].startsWith(REGION_PREFIX)) {
      parts = parts.slice(1)
    }

    const [rawSiteID, rawStoreName, ...rawKey] = parts

    // The path is percent-decoded once, as in production, so a key is stored
    // and listed as the string the client meant. A path that does not decode
    // to valid UTF-8, or that would step out of its store, is refused.
    const siteID = decodeSegment(rawSiteID)
    const decodedStoreName = rawStoreName === undefined ? undefined : decodeSegment(rawStoreName)
    const decodedKey = decodeSegment(rawKey.join('/'))

    if (!siteID || decodedStoreName === null || decodedKey === null) {
      return {}
    }

    const keySegments = decodedKey === '' ? [] : decodedKey.split('/')

    if ([siteID, decodedStoreName, ...keySegments].some((segment) => segment === '.' || segment === '..')) {
      return {}
    }

    const rootPath = resolve(this.directory, 'entries', encodeName(siteID))

    if (!decodedStoreName) {
      return { rootPath }
    }

    const key = keySegments.map(encodeName)

    const storeName = encodeName(decodedStoreName)
    const storePath = resolve(rootPath, storeName)
    const dataPath = resolve(storePath, ...key)
    const metadataPath = resolve(this.directory, 'metadata', encodeName(siteID), storeName, ...key)

    return { dataPath, key: key.join('/'), metadataPath, rootPath: storePath }
  }

  /**
   * Returns a file's ETag as production computes it: the MD5 of the content,
   * quoted. Writing the same content again keeps the ETag.
   * An empty string means there is no such file.
   */
  private static async generateETag(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) {
        return ''
      }

      const cached = etagCache.get(filePath)

      if (cached?.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
        return cached.etag
      }

      const hash = createHash('md5')

      for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk as Buffer)
      }

      const etag = `"${hash.digest('hex')}"`

      etagCache.set(filePath, { etag, mtimeMs: stats.mtimeMs, size: stats.size })

      return etag
    } catch {
      return ''
    }
  }

  private async handleRequest(req: Request): Promise<Response> {
    if (!req.url || !this.validateAccess(req)) {
      return new Response(null, { status: 403 })
    }

    switch (req.method?.toLowerCase()) {
      case HTTPMethod.DELETE: {
        this.dispatchOnRequestEvent(Operation.DELETE, req.url)

        return this.delete(req)
      }

      case HTTPMethod.GET: {
        return this.get(req)
      }

      case HTTPMethod.PUT: {
        this.dispatchOnRequestEvent(Operation.SET, req.url)

        return this.put(req)
      }

      case HTTPMethod.HEAD: {
        this.dispatchOnRequestEvent(Operation.GET_METADATA, req.url)

        return this.head(req)
      }

      default:
        return new Response(null, { status: 405 })
    }
  }

  /**
   * Tries to parse a URL as being an API request and returns the different
   * components, such as the store name, site ID, key, and signed URL.
   */
  private parseAPIRequest(req: Request) {
    if (!req.url) {
      return null
    }

    const apiURLMatch = API_URL_PATH.exec(req.url)

    if (apiURLMatch) {
      const key = apiURLMatch.groups?.key
      const siteID = apiURLMatch.groups?.site_id as string
      const storeName = apiURLMatch.groups?.store_name as string
      const urlPath = [siteID, storeName, key].filter(Boolean) as string[]
      const url = new URL(`/${urlPath.join('/')}?signature=${this.tokenHash}`, this.address)

      return {
        key,
        siteID,
        storeName,
        url,
        useSignedURL: req.headers.get('accept') === SIGNED_URL_ACCEPT_HEADER,
      }
    }

    const legacyAPIURLMatch = LEGACY_API_URL_PATH.exec(req.url)

    if (legacyAPIURLMatch) {
      const fullURL = new URL(req.url, this.address)
      const storeName = fullURL.searchParams.get('context') ?? LEGACY_DEFAULT_STORE
      const key = legacyAPIURLMatch.groups?.key
      const siteID = legacyAPIURLMatch.groups?.site_id as string
      const urlPath = [siteID, storeName, key].filter(Boolean) as string[]
      const url = new URL(`/${urlPath.join('/')}?signature=${this.tokenHash}`, this.address)

      return {
        key,
        siteID,
        storeName,
        url,
        useSignedURL: true,
      }
    }

    return null
  }

  private validateAccess(req: Request) {
    if (!this.token) {
      return true
    }

    const authorization = req.headers.get('authorization') || ''

    if (authorization.toLowerCase().startsWith('bearer ') && authorization.slice('bearer '.length) === this.token) {
      return true
    }

    if (!req.url) {
      return false
    }

    const url = new URL(req.url, this.address)
    const signature = url.searchParams.get('signature')

    if (signature === this.tokenHash) {
      return true
    }

    return false
  }

  /**
   * Traverses a path and collects both blobs and directories into a `result`
   * object, taking into account the `directories` and `prefix` parameters.
   */
  private static async walk(options: {
    directories: boolean
    path: string
    prefix: string
    result: ListResponse
    rootPath: string
  }) {
    const { directories, path, prefix, result, rootPath } = options
    const entries = await fs.readdir(path)

    for (const entry of entries) {
      const entryPath = join(path, entry)
      const stat = await fs.stat(entryPath)

      // Normalize keys to use `/` as delimiter regardless of OS, and undo the
      // encoding that makes each segment a valid file name.
      const key = relative(rootPath, entryPath).split(sep).map(decodeName).join('/')

      // To match the key against the prefix, we start by creating a "mask",
      // which consists of the subset of the key up to the length of the
      // prefix.
      const mask = key.slice(0, prefix.length)

      // There is a match if the mask matches the prefix.
      const isMatch = prefix.startsWith(mask)

      if (!isMatch) {
        continue
      }

      // If the entry is a file, add it to the `blobs` bucket.
      if (!stat.isDirectory()) {
        // Generate a deterministic ETag based on file path and last modified time.
        const etag = await this.generateETag(entryPath)

        result.blobs?.push({
          etag,
          key,
          last_modified: stat.mtime.toISOString(),
          size: stat.size,
        })

        continue
      }

      // The entry is a directory. We push it to the `directories` bucket only
      // if the `directories` parameter is enabled and we're at the same level
      // as the prefix. For example, if the prefix is `animals/cats/` and the
      // key we're processing is `animals`, we don't want to push it to the
      // `directories` bucket. We want to traverse it.
      if (directories && key.startsWith(prefix)) {
        result.directories?.push(`${key}/`)

        continue
      }

      // Call this method recursively with the directory as the starting point.
      await BlobsServer.walk({ directories, path: entryPath, prefix, rootPath, result })
    }
  }

  /**
   * Whether a directory holds at least one file, at any depth.
   */
  private static async hasFiles(path: string): Promise<boolean> {
    const entries = await fs.readdir(path, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isFile() || (entry.isDirectory() && (await BlobsServer.hasFiles(join(path, entry.name))))) {
        return true
      }
    }

    return false
  }

  async start(): Promise<{ address: string; family: string; port: number }> {
    await fs.mkdir(this.directory, { recursive: true })

    const server = new HTTPServer((req: Request) => this.handleRequest(req))
    const address = await server.start(this.port ?? 0)
    const port = Number.parseInt(new URL(address).port)

    this.address = address
    this.server = server

    return {
      address,
      family: 'ipv4',
      port,
    }
  }

  async stop() {
    return this.server?.stop()
  }
}

/**
 * ETags of files already hashed, valid while the file's size and modification
 * time are unchanged.
 */
const etagCache = new Map<string, { etag: string; mtimeMs: number; size: number }>()

/**
 * Compares keys by their UTF-8 bytes, which is the order production lists them in.
 */
const compareKeys = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b))

/**
 * Percent-decodes a path segment, or returns null when it does not decode to
 * valid UTF-8.
 */
const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}
