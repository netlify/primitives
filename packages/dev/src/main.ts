import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { resolveConfig } from '@netlify/config'
import { ensureNetlifyIgnore, getAPIToken, mockLocation, LocalState, type Logger, HTTPServer } from '@netlify/dev-utils'
import { EdgeFunctionsHandler } from '@netlify/edge-functions/dev'
import { FunctionsHandler } from '@netlify/functions/dev'
import { RedirectsHandler } from '@netlify/redirects'
import { StaticHandler } from '@netlify/static'

import { InjectedEnvironmentVariable, injectEnvVariables } from './lib/env.js'
import { isDirectory, isFile } from './lib/fs.js'
import { generateRequestID } from './lib/request_id.js'
import { getRuntime } from './lib/runtime.js'

export interface Features {
  /**
   * Configuration options for Netlify Blobs.
   *
   * {@link} https://docs.netlify.com/blobs/overview/
   */
  blobs?: {
    enabled: boolean
  }

  /**
   * Configuration options for environment variables.
   *
   * {@link} https://docs.netlify.com/edge-functions/overview/
   */
  edgeFunctions?: {
    enabled: boolean
  }

  /**
   * Configuration options for environment variables.
   *
   * {@link} https://docs.netlify.com/environment-variables/overview/
   */
  environmentVariables?: {
    enabled: boolean
  }

  /**
   * Configuration options for Netlify Functions.
   *
   * {@link} https://docs.netlify.com/functions/overview/
   */
  functions?: {
    enabled: boolean
  }

  /**
   * Configuration options for Netlify redirects and rewrites.
   *
   * {@link} https://docs.netlify.com/routing/redirects/
   */
  redirects?: {
    enabled: boolean
  }

  /**
   * If your local development setup has its own HTTP server (e.g. Vite), set
   * its address here.
   */
  serverAddress?: string

  /**
   * Configuration options for serving static files.
   */
  staticFiles?: {
    enabled: boolean
  }
}

interface NetlifyDevOptions extends Features {
  apiURL?: string
  apiToken?: string
  logger?: Logger
  projectRoot?: string
}

const notFoundHandler = async () => new Response('Not found', { status: 404 })

type Config = Awaited<ReturnType<typeof resolveConfig>>

export class NetlifyDev {
  #apiHost?: string
  #apiScheme?: string
  #apiToken?: string
  #cleanupJobs: (() => Promise<void>)[]
  #edgeFunctionsHandler?: EdgeFunctionsHandler
  #functionsHandler?: FunctionsHandler
  #functionsServePath: string
  #config?: Config
  #features: {
    blobs: boolean
    edgeFunctions: boolean
    environmentVariables: boolean
    functions: boolean
    redirects: boolean
    static: boolean
  }
  #logger: Logger
  #projectRoot: string
  #redirectsHandler?: RedirectsHandler
  #server?: string | HTTPServer
  #siteID?: string
  #staticHandler?: StaticHandler

  constructor(options: NetlifyDevOptions) {
    if (options.apiURL) {
      const apiURL = new URL(options.apiURL)

      this.#apiHost = apiURL.host
      this.#apiScheme = apiURL.protocol.slice(0, -1)
    }

    const projectRoot = options.projectRoot ?? process.cwd()

    this.#apiToken = options.apiToken
    this.#cleanupJobs = []
    this.#features = {
      blobs: options.blobs?.enabled !== false,
      edgeFunctions: options.edgeFunctions?.enabled !== false,
      environmentVariables: options.environmentVariables?.enabled !== false,
      functions: options.functions?.enabled !== false,
      redirects: options.redirects?.enabled !== false,
      static: options.staticFiles?.enabled !== false,
    }
    this.#functionsServePath = path.join(projectRoot, '.netlify', 'functions-serve')
    this.#logger = options.logger ?? globalThis.console
    this.#server = options.serverAddress
    this.#projectRoot = projectRoot
  }

  private async handleInEphemeralDirectory(request: Request, destPath: string) {
    // Try to match the request against the different steps in our request chain.
    //
    // https://docs.netlify.com/platform/request-chain/

    // 1. Check if the request matches a function.
    const edgeFunctionMatch = await this.#edgeFunctionsHandler?.handle(request.clone())
    if (edgeFunctionMatch) {
      return edgeFunctionMatch
    }

    // 2. Check if the request matches a function.
    const functionMatch = await this.#functionsHandler?.match(request, destPath)
    if (functionMatch) {
      // If the function prefers static files, check if there is a static match
      // and, if so, return that
      if (functionMatch.preferStatic) {
        const staticMatch = await this.#staticHandler?.match(request)

        if (staticMatch) {
          return staticMatch.handle()
        }
      }

      // Let the function handle the request.
      return functionMatch.handle(request)
    }

    // 3. Check if the request matches a redirect rule.
    const redirectMatch = await this.#redirectsHandler?.match(request)
    if (redirectMatch) {
      // If the redirect rule matches a function, we'll serve it. The exception
      // is if the function prefers static files, which in this case means that
      // we'll follow the redirect rule.
      const functionMatch = await this.#functionsHandler?.match(new Request(redirectMatch.target), destPath)
      if (functionMatch && !functionMatch.preferStatic) {
        return functionMatch.handle(request)
      }

      const response = await this.#redirectsHandler?.handle(
        request,
        redirectMatch,
        async (maybeStaticFile: Request) => {
          const staticMatch = await this.#staticHandler?.match(maybeStaticFile)

          return staticMatch?.handle
        },
      )
      if (response) {
        return response
      }
    }

    // 4. Check if the request matches a static file.
    const staticMatch = await this.#staticHandler?.match(request)
    if (staticMatch) {
      return staticMatch.handle()
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

  async handle(request: Request) {
    const requestID = generateRequestID()

    request.headers.set('x-nf-request-id', requestID)

    await fs.mkdir(this.#functionsServePath, { recursive: true })

    const destPath = await fs.mkdtemp(path.join(this.#functionsServePath, `${requestID}_`))

    try {
      return await this.handleInEphemeralDirectory(request, destPath)
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
      blobs: Boolean(this.#features.blobs),
      deployID: '0',
      projectRoot: this.#projectRoot,
      siteID: siteID ?? '0',
    })

    this.#cleanupJobs.push(() => runtime.stop())

    let serverAddress: string

    // If a custom server has been provided, use it. If not, we must stand up
    // a new one, since it's required for communication with edge functions.
    if (typeof this.#server === 'string') {
      serverAddress = this.#server
    } else {
      const passthroughServer = new HTTPServer(async (req) => {
        const res = await this.handle(req)

        return res ?? new Response(null, { status: 404 })
      })

      this.#cleanupJobs.push(() => passthroughServer.stop())

      serverAddress = await passthroughServer.start()
    }

    let envVariables: Record<string, InjectedEnvironmentVariable> = {}

    if (this.#features.environmentVariables && siteID) {
      // TODO: Use proper types for this.
      envVariables = await injectEnvVariables({
        accountSlug: config?.siteInfo?.account_slug,
        baseVariables: config?.env || {},
        envAPI: runtime.env,
        netlifyAPI: config?.api,
        siteID,
      })
    }

    if (this.#features.edgeFunctions) {
      const env = Object.entries(envVariables).reduce(
        (acc, [key, variable]) => {
          if (
            variable.usedSource === 'account' ||
            variable.usedSource === 'addons' ||
            variable.usedSource === 'internal' ||
            variable.usedSource === 'ui' ||
            variable.usedSource.startsWith('.env')
          ) {
            return {
              ...acc,
              [key]: variable.value,
            }
          }

          return acc
        },
        {} as Record<string, string>,
      )

      this.#edgeFunctionsHandler = new EdgeFunctionsHandler({
        // bootstrapURL: 'https://edge.netlify.com/bootstrap/index-combined.ts',
        bootstrapURL:
          'file:///Users/eduardoboucas/Sites/netlify/edge-functions-bootstrap/src/bootstrap/index-combined.ts',
        configDeclarations: this.#config?.config.edge_functions ?? [],
        directories: [this.#config?.config.build.edge_functions].filter(Boolean) as string[],
        env,
        geolocation: mockLocation,
        originServerAddress: serverAddress,
        siteID,
        siteName: config?.siteInfo.name,
      })
    }

    if (this.#features.functions) {
      const userFunctionsPath =
        this.#config?.config.functionsDirectory ?? path.join(this.#projectRoot, 'netlify/functions')
      const userFunctionsPathExists = await isDirectory(userFunctionsPath)

      this.#functionsHandler = new FunctionsHandler({
        config: this.#config,
        destPath: this.#functionsServePath,
        geolocation: mockLocation,
        projectRoot: this.#projectRoot,
        settings: {},
        siteId: this.#siteID,
        timeouts: {},
        userFunctionsPath: userFunctionsPathExists ? userFunctionsPath : undefined,
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
      this.#staticHandler = new StaticHandler({
        directory: this.#config?.config.build.publish ?? this.#projectRoot,
      })
    }

    return {
      serverAddress,
    }
  }

  async stop() {
    await Promise.allSettled(this.#cleanupJobs.map((task) => task()))
  }
}
