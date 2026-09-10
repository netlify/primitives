import { Buffer } from 'node:buffer'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import type { Duplex } from 'node:stream'

import type { FileWatcher, Geolocation, Logger } from '@netlify/dev-utils'

import { ServerProcess } from './server_process.js'

const SERVER_DIRECTORY = path.join('netlify', 'server')

const ENTRY_BASENAMES = new Set(['index.js', 'index.mjs', 'index.ts', 'index.mts'])

const MINIMUM_NODE_MAJOR_VERSION = 24

const UNLINKED_SITE_MOCK_ID = 'unlinked'

// Headers about the upstream connection or body encoding, which don't apply
// to the response we send.
const NON_FORWARDABLE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
])

export interface ServerMatch {
  handle: (request: Request) => Promise<Response>
  preferStatic: boolean
}

interface ServerHandlerOptions {
  accountID?: string
  fileWatcher?: FileWatcher
  geolocation?: Geolocation
  logger: Logger
  projectRoot: string
  siteID?: string
}

export class ServerHandler {
  #accountID?: string
  #entryPromise?: Promise<string | undefined>
  #geolocation?: Geolocation
  #logger: Logger
  #process?: ServerProcess
  #serverDirectory: string
  #siteID?: string

  constructor(options: ServerHandlerOptions) {
    this.#accountID = options.accountID
    this.#geolocation = options.geolocation
    this.#logger = options.logger
    this.#serverDirectory = path.join(options.projectRoot, SERVER_DIRECTORY)
    this.#siteID = options.siteID

    const restart = () => {
      this.#entryPromise = undefined

      const runningProcess = this.#process

      if (runningProcess) {
        this.#process = undefined
        this.#logger.log('Reloading server...')

        runningProcess.stop().catch((error: unknown) => {
          this.#logger.error(`Failed to stop server process: ${String(error)}`)
        })
      }
    }

    options.fileWatcher?.subscribe({
      id: 'netlify-server-dev',
      paths: this.#serverDirectory,
      onAdd: restart,
      onChange: restart,
      onUnlink: restart,
    })
  }

  private async findEntry(): Promise<string | undefined> {
    let files: string[] = []

    try {
      files = await fs.readdir(this.#serverDirectory)
    } catch {
      return undefined
    }

    const candidates = files.filter((name) => ENTRY_BASENAMES.has(name)).sort()

    if (candidates.length === 0) {
      return undefined
    }

    if (candidates.length > 1) {
      throw new Error(
        `Found multiple server entrypoints in ${SERVER_DIRECTORY} (${candidates.join(
          ', ',
        )}). A site can have one server only.`,
      )
    }

    const majorNodeVersion = Number.parseInt(process.versions.node)

    if (majorNodeVersion < MINIMUM_NODE_MAJOR_VERSION) {
      throw new Error(
        `Netlify Server requires Node.js ${String(MINIMUM_NODE_MAJOR_VERSION)} or above. You are running ${process.versions.node}.`,
      )
    }

    return path.join(this.#serverDirectory, candidates[0])
  }

  private getEntry(): Promise<string | undefined> {
    this.#entryPromise ??= this.findEntry().catch((error: unknown) => {
      this.#entryPromise = undefined

      throw error
    })

    return this.#entryPromise
  }

  private async ensureProcess(): Promise<number> {
    const entryPath = await this.getEntry()

    if (!entryPath) {
      throw new Error(`No server entrypoint found in ${SERVER_DIRECTORY}`)
    }

    this.#process ??= new ServerProcess({ entryPath, logger: this.#logger })

    return this.#process.ensureStarted()
  }

  private setRequestHeaders(headers: Headers, remoteAddress?: string) {
    headers.set('x-nf-client-connection-ip', remoteAddress ?? headers.get('x-forwarded-for') ?? '')
    headers.set('x-nf-site-id', this.#siteID ?? UNLINKED_SITE_MOCK_ID)

    if (this.#accountID) {
      headers.set('x-nf-account-id', this.#accountID)
    }

    if (this.#geolocation) {
      headers.set('x-nf-geo', Buffer.from(JSON.stringify(this.#geolocation)).toString('base64'))
    }
  }

  /**
   * Forwards a request to the server process.
   */
  private async proxy(request: Request): Promise<Response> {
    const port = await this.ensureProcess()
    const url = new URL(request.url)
    const target = `http://127.0.0.1:${String(port)}${url.pathname}${url.search}`
    const headers = new Headers(request.headers)

    this.setRequestHeaders(headers)

    const upstreamResponse = await fetch(target, {
      body: request.body,
      // @ts-expect-error `duplex` is required for streaming request bodies.
      duplex: 'half',
      headers,
      method: request.method,
      redirect: 'manual',
    })

    const responseHeaders = new Headers(upstreamResponse.headers)

    for (const name of NON_FORWARDABLE_HEADERS) {
      responseHeaders.delete(name)
    }

    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    })
  }

  /**
   * Matches every request when a server entrypoint exists.
   */
  async match(_request: Request): Promise<ServerMatch | undefined> {
    const entryPath = await this.getEntry()

    if (!entryPath) {
      return undefined
    }

    return {
      handle: (request: Request) => this.proxy(request),
      preferStatic: true,
    }
  }

  /**
   * Takes over an HTTP upgrade (e.g. a WebSocket handshake) by piping the raw
   * socket to the server process.
   */
  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<boolean> {
    const entryPath = await this.getEntry().catch(() => undefined)

    if (!entryPath) {
      return false
    }

    const port = await this.ensureProcess()
    const upstream = net.connect(port, '127.0.0.1')

    const destroyBoth = () => {
      socket.destroy()
      upstream.destroy()
    }

    upstream.on('error', destroyBoth)
    socket.on('error', destroyBoth)

    await once(upstream, 'connect')

    const headers = new Headers()

    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      headers.append(request.rawHeaders[index], request.rawHeaders[index + 1])
    }

    this.setRequestHeaders(headers, request.socket.remoteAddress)

    const headLines = [`${request.method ?? 'GET'} ${request.url ?? '/'} HTTP/1.1`]

    for (const [name, value] of headers) {
      headLines.push(`${name}: ${value}`)
    }

    // Node consumed the original handshake bytes when it parsed the request,
    // so replay them: the raw HTTP request head, then a blank line to end it.
    upstream.write(`${headLines.join('\r\n')}\r\n\r\n`)

    if (head.length > 0) {
      upstream.write(head)
    }

    upstream.pipe(socket)
    socket.pipe(upstream)

    return true
  }

  async stop(): Promise<void> {
    const runningProcess = this.#process

    this.#process = undefined

    await runningProcess?.stop()
  }
}
