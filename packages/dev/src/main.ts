import { promises as fs } from 'node:fs'
import { IncomingMessage } from 'node:http'
import path from 'node:path'
import process from 'node:process'

import { resolveConfig } from '@netlify/config'
import {
  ensureNetlifyIgnore,
  getAPIToken,
  getGeoLocation,
  type Geolocation,
  LocalState,
  type Logger,
  HTTPServer,
} from '@netlify/dev-utils'
import { EdgeFunctionsHandler } from '@netlify/edge-functions-dev'
import { FunctionsHandler } from '@netlify/functions-dev'
import { HeadersHandler, type HeadersCollector } from '@netlify/headers'
import { ImageHandler } from '@netlify/images'
import { RedirectsHandler } from '@netlify/redirects'
import { StaticHandler } from '@netlify/static'

import { InjectedEnvironmentVariable, injectEnvVariables } from './lib/env.js'
import { isDirectory, isFile } from './lib/fs.js'
import { getNormalizedRequest, getNormalizedRequestFromNodeRequest } from './lib/reqres.js'
import { generateRequestID } from './lib/request_id.js'
import { getRuntime } from './lib/runtime.js'

export interface Features {
  /**
   * Configuration options for Netlify Blobs.
   *
   * {@link} https://docs.netlify.com/blobs/overview/
   */
  blobs?: {
    enabled?: boolean
  }

  /**
   * Configuration options for environment variables.
   *
   * {@link} https://docs.netlify.com/edge-functions/overview/
   */
  edgeFunctions?: {
    enabled?: boolean
  }

  /**
   * Configuration options for environment variables.
   *
   * {@link} https://docs.netlify.com/environment-variables/overview/
   */
  environmentVariables?: {
    enabled?: boolean
  }

  /**
   * Configuration options for Netlify Functions.
   *
   * {@link} https://docs.netlify.com/functions/overview/
   */
  functions?: {
    enabled?: boolean
  }

  /**
   * Configuration options for geolocation data used by Functions and Edge Functions.
   *
   * {@link} https://docs.netlify.com/build/edge-functions/api/#geo
   */
  geolocation?: {
    enabled?: boolean

    /**
     * Cache the result of the API call. When disabled, the location is retrieved
     * each time.
     *
     * {@default} true
     */
    cache?: boolean
  }

  /**
   * Configuration options for Netlify response headers.
   *
   * {@link} https://docs.netlify.com/routing/headers/
   */
  headers?: {
    enabled?: boolean
  }

  /**
   * Configuration options for Netlify Image CDN.
   *
   * {@link} https://docs.netlify.com/image-cdn/overview/
   */
  images?: {
    enabled?: boolean

    /**
     * Allowed URL patterns for remote images, described as an array of regular
     * expression strings. This list will be merged with  the `remote_images`
     * configuration property.
     *
     * {@link} https://docs.netlify.com/image-cdn/overview/#remote-path
     */
    remoteURLPatterns?: string[]
  }

  /**
   * Configuration options for Netlify redirects and rewrites.
   *
   * {@link} https://docs.netlify.com/routing/redirects/
   */
  redirects?: {
    enabled?: boolean
  }

  /**
   * Configuration options for serving static files.
   */
  staticFiles?: {
    enabled?: boolean

    /**
     * List of directories where static files can be found. If not provided,
     * the `publish` directory configured on your Netlify project will be used automatically.
     */
    directories?: string[]
  }
}

interface NetlifyDevOptions extends Features {
  apiURL?: string
  apiToken?: string
  logger?: Logger
  projectRoot?: string

  /**
   * If your local development setup has its own HTTP server (e.g. Vite), set
   * its address here.
   */
  serverAddress?: string | null
}

const notFoundHandler = async () => new Response('Not found', { status: 404 })

type Config = Awaited<ReturnType<typeof resolveConfig>>

interface HandleOptions {
  /**
   * An optional callback that will be called with every header (key and value)
   * coming from header rules.
   *
   * {@link} https://docs.netlify.com/routing/headers/
   */
  headersCollector?: HeadersCollector

  /**
   * If your local development setup has its own HTTP server (e.g. Vite), you
   * can supply its address here. It will override any value defined in the
   * top-level `serverAddress` setting.
   */
  serverAddress?: string
}

export type ResponseType = 'edge-function' | 'function' | 'image' | 'redirect' | 'static'

export class NetlifyDev {
  #apiHost?: string
  #apiScheme?: string
  #apiToken?: string
  #cleanupJobs: (() => Promise<void>)[]
  #edgeFunctionsHandler?: EdgeFunctionsHandler
  #functionsHandler?: FunctionsHandler
  #geolocationConfig?: NetlifyDevOptions['geolocation']
  #functionsServePath: string
  #config?: Config
  #features: {
    blobs: boolean
    edgeFunctions: boolean
    environmentVariables: boolean
    functions: boolean
    geolocation: boolean
    headers: boolean
    images: boolean
    redirects: boolean
    static: boolean
  }
  #headersHandler?: HeadersHandler
  #imageRemoteURLPatterns: string[]
  #imageHandler?: ImageHandler
  #logger: Logger
  #projectRoot: string
  #redirectsHandler?: RedirectsHandler
  #serverAddress?: string | null
  #siteID?: string
  #staticHandler?: StaticHandler
  #staticHandlerDirectories?: string[]

  constructor(options: NetlifyDevOptions) {
    if (options.apiURL) {
      const apiURL = new URL(options.apiURL)

      this.#apiHost = apiURL.host
      this.#apiScheme = apiURL.protocol.slice(0, -1)
    }

    const projectRoot = options.projectRoot ?? process.cwd()

    this.#apiToken = options.apiToken
    this.#cleanupJobs = []
    this.#geolocationConfig = options.geolocation
    this.#features = {
      blobs: options.blobs?.enabled !== false,
      edgeFunctions: options.edgeFunctions?.enabled !== false,
      environmentVariables: options.environmentVariables?.enabled !== false,
      functions: options.functions?.enabled !== false,
      geolocation: options.geolocation?.enabled !== false,
      headers: options.headers?.enabled !== false,
      images: options.images?.enabled !== false,
      redirects: options.redirects?.enabled !== false,
      static: options.staticFiles?.enabled !== false,
    }
    this.#functionsServePath = path.join(projectRoot, '.netlify', 'functions-serve')
    this.#imageRemoteURLPatterns = options.images?.remoteURLPatterns ?? []
    this.#logger = options.logger ?? globalThis.console
    this.#serverAddress = options.serverAddress
    this.#projectRoot = projectRoot
    this.#staticHandlerDirectories = options.staticFiles?.directories ?? undefined
  }

  private getServerAddress(requestServerAddress?: string) {
    if (requestServerAddress) {
      return requestServerAddress
    }

    if (typeof this.#serverAddress === 'string') {
      return this.#serverAddress
    }

    throw new Error('Server address is not defined')
  }

  /**
   * Runs a request through the Netlify request chain and returns a `Response`
   * if there's a match. We must not disturb the incoming request unless we
   * know we will be returning a response, so this method takes a read-only
   * request that is safe to access (used for matching) and a getter for the
   * actual request (used for handling matches).
   *
   * @param readRequest Read-only version of the request (without a body)
   * @param getWriteRequest Getter for the actual request (with a body)
   * @param destPath Destination directory for compiled files
   * @param options Options object
   * @returns
   */
  private async handleInEphemeralDirectory(
    readRequest: Request,
    getWriteRequest: () => Request,
    destPath: string,
    options: HandleOptions = {},
  ): Promise<{ response: Response; type: ResponseType } | undefined> {
    const serverAddress = this.getServerAddress(options.serverAddress)

    // Try to match the request against the different steps in our request chain.
    //
    // https://docs.netlify.com/platform/request-chain/

    // 1. Check if the request matches an edge function. Handles edge functions
    //    with both modes of cache (manual and off) by running them serially.
    const edgeFunctionMatch = await this.#edgeFunctionsHandler?.match(readRequest)
    if (edgeFunctionMatch) {
      return {
        response: await edgeFunctionMatch.handle(getWriteRequest(), serverAddress),
        type: 'edge-function',
      }
    }

    // 2. Check if the request matches an image.
    const imageMatch = this.#imageHandler?.match(readRequest)
    if (imageMatch) {
      const response = await imageMatch.handle(serverAddress)
      return { response, type: 'image' }
    }

    // 3. Check if the request matches a function.
    const functionMatch = await this.#functionsHandler?.match(readRequest, destPath)
    if (functionMatch) {
      // If the function prefers static files, check if there is a static match
      // and, if so, return that
      if (functionMatch.preferStatic) {
        const staticMatch = await this.#staticHandler?.match(readRequest)

        if (staticMatch) {
          const response = await staticMatch.handle()

          await this.#headersHandler?.apply(readRequest, response, options.headersCollector)

          return { response, type: 'static' }
        }
      }

      // Let the function handle the request.
      return { response: await functionMatch.handle(getWriteRequest()), type: 'function' }
    }

    // 4. Check if the request matches a redirect rule.
    const redirectMatch = await this.#redirectsHandler?.match(readRequest)
    if (redirectMatch) {
      const redirectRequest = new Request(redirectMatch.target)
      // If the redirect rule matches Image CDN, we'll serve it.
      const imageMatch = this.#imageHandler?.match(redirectRequest)
      if (imageMatch) {
        const response = await imageMatch.handle(serverAddress)
        return { response, type: 'image' }
      }

      // If the redirect rule matches a function, we'll serve it. The exception
      // is if the function prefers static files, which in this case means that
      // we'll follow the redirect rule.
      const functionMatch = await this.#functionsHandler?.match(redirectRequest, destPath)
      if (functionMatch && !functionMatch.preferStatic) {
        return {
          response: await functionMatch.handle(getWriteRequest()),
          type: 'function',
        }
      }

      const response = await this.#redirectsHandler?.handle(
        getWriteRequest(),
        redirectMatch,
        async (maybeStaticFile: Request) => {
          const staticMatch = await this.#staticHandler?.match(maybeStaticFile)
          if (!staticMatch) {
            return
          }

          return async () => {
            const response = await staticMatch.handle()

            await this.#headersHandler?.apply(new Request(redirectMatch.target), response, options.headersCollector)

            return response
          }
        },
      )
      if (response) {
        return { response, type: 'redirect' }
      }
    }

    // 5. Check if the request matches a static file.
    const staticMatch = await this.#staticHandler?.match(readRequest)
    if (staticMatch) {
      const response = await staticMatch.handle()

      await this.#headersHandler?.apply(readRequest, response, options.headersCollector)

      return { response, type: 'static' }
    }
  }

  private async getConfig() {
    const configFilePath = path.resolve(this.#projectRoot, 'netlify.toml')
    const configFileExists = await isFile(configFilePath)
    const config = await resolveConfig({
      config: configFileExists ? configFilePath : undefined,
      context: 'dev',
      cwd: process.cwd(),
      host: this.#apiHost,
      offline: !this.#siteID,
      mode: 'cli',
      repositoryRoot: this.#projectRoot,
      scheme: this.#apiScheme,
      siteId: this.#siteID,
      token: this.#apiToken,
    })

    return config
  }

  /**
   * Runs a `Request` through the Netlify request chain. If there is a match,
   * it returns the resulting `Response` object; if not, it returns `undefined`.
   */
  async handle(request: Request, options: HandleOptions = {}) {
    const result = await this.handleAndIntrospect(request, options)

    return result?.response
  }

  /**
   * Runs a `Request` through the Netlify request chain. If there is a match,
   * it returns an object with the resulting `Response` object and information
   * about the match; if not, it returns `undefined`.
   */
  async handleAndIntrospect(request: Request, options: HandleOptions = {}) {
    await fs.mkdir(this.#functionsServePath, { recursive: true })

    const destPath = await fs.mkdtemp(path.join(this.#functionsServePath, `_`))
    const requestID = generateRequestID()
    const matchRequest = getNormalizedRequest(request, requestID, true)
    const getHandleRequest = () => getNormalizedRequest(request, requestID, false)

    try {
      return await this.handleInEphemeralDirectory(matchRequest, getHandleRequest, destPath, options)
    } finally {
      try {
        await fs.rm(destPath, { force: true, recursive: true })
      } catch {}
    }
  }

  /**
   * Runs a Node.js `IncomingMessage` through the Netlify request chain. If
   * there is a match, it returns an object with the resulting `Response`
   * object and information about the match; if not, it returns `undefined`.
   */
  async handleAndIntrospectNodeRequest(request: IncomingMessage, options: HandleOptions = {}) {
    await fs.mkdir(this.#functionsServePath, { recursive: true })

    const destPath = await fs.mkdtemp(path.join(this.#functionsServePath, `_`))
    const requestID = generateRequestID()
    const matchRequest = getNormalizedRequestFromNodeRequest(request, requestID, true)
    const getHandleRequest = () => getNormalizedRequestFromNodeRequest(request, requestID, false)

    try {
      return await this.handleInEphemeralDirectory(matchRequest, getHandleRequest, destPath, options)
    } finally {
      try {
        await fs.rm(destPath, { force: true, recursive: true })
      } catch {}
    }
  }

  get siteIsLinked() {
    return Boolean(this.#siteID)
  }

  async start() {
    await ensureNetlifyIgnore(this.#projectRoot, this.#logger)

    this.#apiToken = this.#apiToken ?? (await getAPIToken())

    const state = new LocalState(this.#projectRoot)
    const siteID = state.get('siteId')
    this.#siteID = siteID

    const config = await this.getConfig()
    this.#config = config

    const runtime = await getRuntime({
      blobs: this.#features.blobs,
      deployID: '0',
      projectRoot: this.#projectRoot,
      siteID: siteID ?? '0',
    })

    this.#cleanupJobs.push(() => runtime.stop())

    let serverAddress: string | undefined

    // If a custom server has been provided, use it. If not, we must stand up
    // a new one, since it's required for communication with edge functions
    // and local images support for Image CDN.
    if (typeof this.#serverAddress === 'string') {
      serverAddress = this.#serverAddress
    } else if (this.#serverAddress !== null && (this.#features.edgeFunctions || this.#features.images)) {
      const passthroughServer = new HTTPServer(async (req) => {
        const res = await this.handle(req)

        return res ?? new Response(null, { status: 404 })
      })

      this.#cleanupJobs.push(() => passthroughServer.stop())

      serverAddress = await passthroughServer.start()
      this.#serverAddress = serverAddress
    }

    let envVariables: Record<string, InjectedEnvironmentVariable> = {}

    if (this.#features.environmentVariables) {
      // TODO: Use proper types for this.
      envVariables = await injectEnvVariables({
        accountSlug: config?.siteInfo?.account_slug,
        baseVariables: config?.env || {},
        envAPI: runtime.env,
        netlifyAPI: config?.api,
        siteID,
      })
    }

    let geolocation: Geolocation | undefined

    if (this.#features.edgeFunctions) {
      const edgeFunctionsEnv = {
        // User-defined env vars + documented runtime env vars
        ...Object.entries(envVariables).reduce<Record<string, string>>(
          (acc, [key, variable]) => ({
            ...acc,
            [key]: variable.value,
          }),
          {},
        ),
        // Add runtime env vars that we've set ourselves so far. These are "internal" env vars,
        // part of the runtime emulation. They've already been populated on this process's env, which
        // is needed to make other dev features work. These are different than the "documented" runtime
        // env vars, in that they are implementation details, needed to make our features work.
        ...Object.keys(runtime.envSnapshot).reduce<Record<string, string>>(
          (acc, key) => ({
            ...acc,
            [key]: runtime.env.get(key) ?? '',
          }),
          {},
        ),
      }

      geolocation ??= await getGeoLocation({
        enabled: this.#features.geolocation,
        cache: this.#geolocationConfig?.cache ?? true,
        state,
      })

      const edgeFunctionsHandler = new EdgeFunctionsHandler({
        configDeclarations: this.#config?.config.edge_functions ?? [],
        directories: [this.#config?.config.build.edge_functions].filter(Boolean) as string[],
        env: edgeFunctionsEnv,
        geolocation,
        logger: this.#logger,
        siteID,
        siteName: config?.siteInfo.name,
      })
      this.#edgeFunctionsHandler = edgeFunctionsHandler

      this.#cleanupJobs.push(() => edgeFunctionsHandler.stop())
    }

    if (this.#features.functions) {
      const userFunctionsPath =
        this.#config?.config.functionsDirectory ?? path.join(this.#projectRoot, 'netlify/functions')
      const userFunctionsPathExists = await isDirectory(userFunctionsPath)

      geolocation ??= await getGeoLocation({
        enabled: this.#features.geolocation,
        cache: this.#geolocationConfig?.cache ?? true,
        state,
      })

      this.#functionsHandler = new FunctionsHandler({
        config: this.#config,
        destPath: this.#functionsServePath,
        geolocation,
        projectRoot: this.#projectRoot,
        settings: {},
        siteId: this.#siteID,
        timeouts: {},
        userFunctionsPath: userFunctionsPathExists ? userFunctionsPath : undefined,
      })
    }

    if (this.#features.headers) {
      this.#headersHandler = new HeadersHandler({
        configPath: this.#config?.configPath,
        configHeaders: this.#config?.config.headers,
        projectDir: this.#projectRoot,
        publishDir: this.#config?.config.build.publish ?? undefined,
        logger: this.#logger,
      })
    }

    if (this.#features.redirects) {
      this.#redirectsHandler = new RedirectsHandler({
        configPath: this.#config?.configPath,
        configRedirects: this.#config?.config.redirects,
        jwtRoleClaim: '',
        jwtSecret: '',
        notFoundHandler,
        projectDir: this.#projectRoot,
      })
    }

    if (this.#features.static) {
      // If custom static directories are provided (e.g., by `@netlify/vite-plugin` or `@netlify/nuxt`),
      // use those directories. Otherwise, use the build.publish directory from config.
      const directories = this.#staticHandlerDirectories ?? [this.#config?.config.build.publish ?? this.#projectRoot]

      this.#staticHandler = new StaticHandler({
        directory: directories,
      })
    }

    if (this.#features.images) {
      const remoteImages = [...(this.#config?.config?.images?.remote_images ?? []), ...this.#imageRemoteURLPatterns]

      this.#imageHandler = new ImageHandler({
        imagesConfig: {
          remote_images: remoteImages,
        },
        logger: this.#logger,
      })
    }

    return {
      serverAddress,
    }
  }

  async stop() {
    await Promise.allSettled(this.#cleanupJobs.map((task) => task()))
  }

  public getEnabledFeatures(): string[] {
    return Object.entries(this.#features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature)
  }
}
