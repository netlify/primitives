import { createHmac } from 'node:crypto'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { platform } from 'node:process'
import stream from 'node:stream'
import { promisify } from 'node:util'

import { ListResponse } from './backend/list.ts'
import { SIGNED_URL_ACCEPT_HEADER } from './client.ts'
import { decodeMetadata, encodeMetadata, METADATA_HEADER_INTERNAL } from './metadata.ts'
import { HTTPMethod } from './types.ts'
import { isNodeError, Logger } from './util.ts'

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

// TODO: Replace with `promises` import of `node:stream` once we can drop
// support for Node 14.
const pipeline = promisify(stream.pipeline)

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
  private port: number
  private server?: http.Server
  private token?: string
  private tokenHash: string

  constructor({ debug, directory, logger, onRequest, port, token }: BlobsServerOptions) {
    this.address = ''
    this.debug = debug === true
    this.directory = directory
    this.logger = logger ?? console.log
    this.onRequest = onRequest
    this.port = port || 0
    this.token = token
    this.tokenHash = createHmac('sha256', Math.random.toString())
      .update(token ?? Math.random.toString())
      .digest('hex')
  }

  private dispatchOnRequestEvent(type: Operation, url: string | URL) {
    if (!this.onRequest) {
      return
    }

    const urlPath = url instanceof URL ? url.pathname + url.search : url

    this.onRequest({ type, url: urlPath })
  }

  logDebug(...message: unknown[]) {
    if (!this.debug) {
      return
    }

    this.logger('[Netlify Blobs server]', ...message)
  }

  async delete(req: http.IncomingMessage, res: http.ServerResponse) {
    const apiMatch = this.parseAPIRequest(req)

    if (apiMatch?.useSignedURL) {
      return this.sendResponse(req, res, 200, JSON.stringify({ url: apiMatch.url.toString() }))
    }

    const url = new URL(apiMatch?.url ?? req.url ?? '', this.address)
    const { dataPath, key, metadataPath } = this.getLocalPaths(url)

    if (!dataPath || !key) {
      return this.sendResponse(req, res, 400)
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
        return this.sendResponse(req, res, 500)
      }
    }

    return this.sendResponse(req, res, 204)
  }

  async get(req: http.IncomingMessage, res: http.ServerResponse) {
    const apiMatch = this.parseAPIRequest(req)
    const url = apiMatch?.url ?? new URL(req.url ?? '', this.address)

    if (apiMatch?.key && apiMatch?.useSignedURL) {
      return this.sendResponse(req, res, 200, JSON.stringify({ url: apiMatch.url.toString() }))
    }

    const { dataPath, key, metadataPath, rootPath } = this.getLocalPaths(apiMatch?.url ?? url)

    // If there's no root path, the request is invalid.
    if (!rootPath) {
      return this.sendResponse(req, res, 400)
    }

    // If there's no data or metadata paths, it means we're listing stores.
    if (!dataPath || !metadataPath) {
      return this.listStores(req, res, rootPath, url.searchParams.get('prefix') ?? '')
    }

    // If there is no key in the URL, it means we're listing blobs.
    if (!key) {
      return this.listBlobs({ dataPath, metadataPath, rootPath, req, res, url })
    }

    this.dispatchOnRequestEvent(Operation.GET, url)

    const headers: Record<string, string> = {}

    try {
      const rawData = await fs.readFile(metadataPath, 'utf8')
      const metadata = JSON.parse(rawData)
      const encodedMetadata = encodeMetadata(metadata)

      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        this.logDebug('Could not read metadata file:', error)
      }
    }

    for (const name in headers) {
      res.setHeader(name, headers[name])
    }

    const stream = createReadStream(dataPath)

    stream.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EISDIR' || error.code === 'ENOENT') {
        return this.sendResponse(req, res, 404)
      }

      return this.sendResponse(req, res, 500)
    })
    stream.pipe(res)
  }

  async head(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = this.parseAPIRequest(req)?.url ?? new URL(req.url ?? '', this.address)
    const { dataPath, key, metadataPath } = this.getLocalPaths(url)

    if (!dataPath || !metadataPath || !key) {
      return this.sendResponse(req, res, 400)
    }

    try {
      const rawData = await fs.readFile(metadataPath, 'utf8')
      const metadata = JSON.parse(rawData)
      const encodedMetadata = encodeMetadata(metadata)

      if (encodedMetadata) {
        res.setHeader(METADATA_HEADER_INTERNAL, encodedMetadata)
      }
    } catch (error) {
      if (isNodeError(error) && (error.code === 'ENOENT' || error.code === 'ISDIR')) {
        return this.sendResponse(req, res, 404)
      }

      this.logDebug('Could not read metadata file:', error)

      return this.sendResponse(req, res, 500)
    }

    res.end()
  }

  async listBlobs(options: {
    dataPath: string
    metadataPath: string
    rootPath: string
    req: http.IncomingMessage
    res: http.ServerResponse
    url: URL
  }) {
    const { dataPath, rootPath, req, res, url } = options
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

        return this.sendResponse(req, res, 500)
      }
    }

    res.setHeader('content-type', 'application/json')

    return this.sendResponse(req, res, 200, JSON.stringify(result))
  }

  async listStores(req: http.IncomingMessage, res: http.ServerResponse, rootPath: string, prefix: string) {
    try {
      const allStores = await fs.readdir(rootPath)
      const filteredStores = allStores
        // Store names are URI-encoded on Windows, so we must decode them first.
        .map((store) => (platform === 'win32' ? decodeURIComponent(store) : store))
        .filter((store) => store.startsWith(prefix))

      return this.sendResponse(req, res, 200, JSON.stringify({ stores: filteredStores }))
    } catch (error) {
      this.logDebug('Could not list stores:', error)

      return this.sendResponse(req, res, 500)
    }
  }

  async put(req: http.IncomingMessage, res: http.ServerResponse) {
    const apiMatch = this.parseAPIRequest(req)

    if (apiMatch) {
      return this.sendResponse(req, res, 200, JSON.stringify({ url: apiMatch.url.toString() }))
    }

    const url = new URL(req.url ?? '', this.address)
    const { dataPath, key, metadataPath } = this.getLocalPaths(url)

    if (!dataPath || !key || !metadataPath) {
      return this.sendResponse(req, res, 400)
    }

    const metadataHeader = req.headers[METADATA_HEADER_INTERNAL]
    const metadata = decodeMetadata(Array.isArray(metadataHeader) ? metadataHeader[0] : metadataHeader ?? null)

    try {
      // We can't have multiple requests writing to the same file, which could
      // lead to corrupted data. Ideally we'd have a mechanism where the last
      // request wins, but that requires a more advanced state manager. For
      // now, we address this by writing data to a temporary file and then
      // moving it to the right path after the write has succeeded.
      const tempDirectory = await fs.mkdtemp(join(tmpdir(), 'netlify-blobs'))
      const relativeDataPath = relative(this.directory, dataPath)
      const tempDataPath = join(tempDirectory, relativeDataPath)

      await fs.mkdir(dirname(tempDataPath), { recursive: true })
      await pipeline(req, createWriteStream(tempDataPath))

      await fs.mkdir(dirname(dataPath), { recursive: true })
      await fs.copyFile(tempDataPath, dataPath)
      await fs.rm(tempDirectory, { force: true, recursive: true })

      await fs.mkdir(dirname(metadataPath), { recursive: true })
      await fs.writeFile(metadataPath, JSON.stringify(metadata))
    } catch (error) {
      this.logDebug('Error when writing data:', error)

      return this.sendResponse(req, res, 500)
    }

    return this.sendResponse(req, res, 200)
  }

  /**
   * Parses the URL and returns the filesystem paths where entries and metadata
   * should be stored.
   */
  getLocalPaths(url?: URL) {
    if (!url) {
      return {}
    }

    let parts = url.pathname.split('/').slice(1)

    if (parts[0].startsWith(REGION_PREFIX)) {
      parts = parts.slice(1)
    }

    const [siteID, rawStoreName, ...key] = parts

    if (!siteID) {
      return {}
    }

    const rootPath = resolve(this.directory, 'entries', siteID)

    if (!rawStoreName) {
      return { rootPath }
    }

    // On Windows, file paths can't include the `:` character, so we URI-encode
    // them.
    const storeName = platform === 'win32' ? encodeURIComponent(rawStoreName) : rawStoreName
    const storePath = resolve(rootPath, storeName)
    const dataPath = resolve(storePath, ...key)
    const metadataPath = resolve(this.directory, 'metadata', siteID, storeName, ...key)

    return { dataPath, key: key.join('/'), metadataPath, rootPath: storePath }
  }

  handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!req.url || !this.validateAccess(req)) {
      return this.sendResponse(req, res, 403)
    }

    switch (req.method?.toLowerCase()) {
      case HTTPMethod.DELETE: {
        this.dispatchOnRequestEvent(Operation.DELETE, req.url)

        return this.delete(req, res)
      }

      case HTTPMethod.GET: {
        return this.get(req, res)
      }

      case HTTPMethod.PUT: {
        this.dispatchOnRequestEvent(Operation.SET, req.url)

        return this.put(req, res)
      }

      case HTTPMethod.HEAD: {
        this.dispatchOnRequestEvent(Operation.GET_METADATA, req.url)

        return this.head(req, res)
      }

      default:
        return this.sendResponse(req, res, 405)
    }
  }

  /**
   * Tries to parse a URL as being an API request and returns the different
   * components, such as the store name, site ID, key, and signed URL.
   */
  parseAPIRequest(req: http.IncomingMessage) {
    if (!req.url) {
      return null
    }

    const apiURLMatch = req.url.match(API_URL_PATH)

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
        useSignedURL: req.headers.accept === SIGNED_URL_ACCEPT_HEADER,
      }
    }

    const legacyAPIURLMatch = req.url.match(LEGACY_API_URL_PATH)

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

  sendResponse(req: http.IncomingMessage, res: http.ServerResponse, status: number, body?: string) {
    this.logDebug(`${req.method} ${req.url} ${status}`)

    res.writeHead(status)
    res.end(body)
  }

  async start(): Promise<{ address: string; family: string; port: number }> {
    await fs.mkdir(this.directory, { recursive: true })

    const server = http.createServer((req, res) => this.handleRequest(req, res))

    this.server = server

    return new Promise((resolve, reject) => {
      server.listen(this.port, () => {
        const address = server.address()

        if (!address || typeof address === 'string') {
          return reject(new Error('Server cannot be started on a pipe or Unix socket'))
        }

        this.address = `http://localhost:${address.port}`

        resolve(address)
      })
    })
  }

  async stop() {
    if (!this.server) {
      return
    }

    await new Promise((resolve, reject) => {
      this.server?.close((error?: NodeJS.ErrnoException) => {
        if (error) {
          return reject(error)
        }

        resolve(null)
      })
    })
  }

  validateAccess(req: http.IncomingMessage) {
    if (!this.token) {
      return true
    }

    const { authorization = '' } = req.headers

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

      let key = relative(rootPath, entryPath)

      // Normalize keys to use `/` as delimiter regardless of OS.
      if (sep !== '/') {
        key = key.split(sep).join('/')
      }

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
        // We don't support conditional requests in the local server, so we
        // generate a random ETag for each entry.
        const etag = Math.random().toString().slice(2)

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
        result.directories?.push(key)

        continue
      }

      // Call this method recursively with the directory as the starting point.
      await BlobsServer.walk({ directories, path: entryPath, prefix, rootPath, result })
    }
  }
}
