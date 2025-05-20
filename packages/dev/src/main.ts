import path from 'node:path'
import process from 'node:process'

import { resolveConfig } from '@netlify/config'
import { ensureNetlifyIgnore, getAPIToken, LocalState, type Logger } from '@netlify/dev-utils'
import { FunctionsHandler } from '@netlify/functions/dev'
import { RedirectsHandler } from '@netlify/redirects'
import { StaticHandler } from '@netlify/static'

import { injectEnvVariables } from './lib/env.js'
import { isDirectory, isFile } from './lib/fs.js'
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
   * Configuration options for serving static files.
   */
  staticFiles?: {
    enabled: boolean
  }
}

interface NetlifyDevOptions extends Features {
  apiURL?: string
  logger?: Logger
  projectRoot?: string
}

const notFoundHandler = async () => new Response('Not found', { status: 404 })

type Config = Awaited<ReturnType<typeof resolveConfig>>
type Runtime = { stop: () => Promise<void> }

export class NetlifyDev {
  #apiHost?: string
  #apiScheme?: string
  #apiToken?: string
  #config?: Config
  #features: {
    blobs: boolean
    environmentVariables: boolean
    functions: boolean
    redirects: boolean
    static: boolean
  }
  #logger: Logger
  #projectRoot: string
  #runtime?: Runtime
  #siteID?: string

  constructor(options: NetlifyDevOptions) {
    if (options.apiURL) {
      const apiURL = new URL(options.apiURL)

      this.#apiHost = apiURL.host
      this.#apiScheme = apiURL.protocol.slice(0, -1)
    }

    this.#features = {
      blobs: options.blobs?.enabled !== false,
      environmentVariables: options.environmentVariables?.enabled !== false,
      functions: options.functions?.enabled !== false,
      redirects: options.redirects?.enabled !== false,
      static: options.staticFiles?.enabled !== false,
    }
    this.#logger = options.logger ?? globalThis.console
    this.#projectRoot = options.projectRoot ?? process.cwd()
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
    // Functions
    const userFunctionsPath =
      this.#config?.config.functionsDirectory ?? path.join(this.#projectRoot, 'netlify/functions')
    const userFunctionsPathExists = await isDirectory(userFunctionsPath)
    const functions = this.#features.functions
      ? new FunctionsHandler({
          config: this.#config,
          destPath: path.join(this.#projectRoot, '.netlify', 'functions-serve'),
          projectRoot: this.#projectRoot,
          settings: {},
          siteId: this.#siteID,
          timeouts: {},
          userFunctionsPath: userFunctionsPathExists ? userFunctionsPath : undefined,
        })
      : null

    // Redirects
    const redirects = this.#features.redirects
      ? new RedirectsHandler({
          configPath: this.#config?.configPath,
          configRedirects: this.#config?.config.redirects,
          jwtRoleClaim: '',
          jwtSecret: '',
          notFoundHandler,
          projectDir: this.#projectRoot,
        })
      : null

    // Static files
    const staticFiles = this.#features.static
      ? new StaticHandler({
          directory: this.#config?.config.build.publish ?? this.#projectRoot,
        })
      : null

    // Try to match the request against the different steps in our request chain.
    //
    // https://docs.netlify.com/platform/request-chain/

    // 1. Check if the request matches a function.
    const functionMatch = await functions?.match(request)
    if (functionMatch) {
      // If the function prefers static files, check if there is a static match
      // and, if so, return that
      if (functionMatch.preferStatic) {
        const staticMatch = await staticFiles?.match(request)

        if (staticMatch) {
          return staticMatch.handle()
        }
      }

      // Let the function handle the request.
      return functionMatch.handle(request)
    }

    // 2. Check if the request matches a redirect rule.
    const redirectMatch = await redirects?.match(request)
    if (redirectMatch) {
      // If the redirect rule matches a function, we'll serve it. The exception
      // is if the function prefers static files, which in this case means that
      // we'll follow the redirect rule.
      const functionMatch = await functions?.match(new Request(redirectMatch.target))
      if (functionMatch && !functionMatch.preferStatic) {
        return functionMatch.handle(request)
      }

      const response = await redirects?.handle(request, redirectMatch, async (maybeStaticFile: Request) => {
        const staticMatch = await staticFiles?.match(maybeStaticFile)

        return staticMatch?.handle
      })
      if (response) {
        return response
      }
    }

    // 3. Check if the request matches a static file.
    const staticMatch = await staticFiles?.match(request)
    if (staticMatch) {
      return staticMatch.handle()
    }
  }

  get siteIsLinked() {
    return Boolean(this.#siteID)
  }

  async start() {
    await ensureNetlifyIgnore(this.#projectRoot, this.#logger)

    const apiToken = await getAPIToken()
    this.#apiToken = apiToken

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
    this.#runtime = runtime

    const accountSlug = config?.siteInfo?.account_slug as string | undefined

    console.log('-> Start', { accountSlug, siteID, api: Boolean(config?.api) })

    if (this.#features.environmentVariables && siteID && accountSlug) {
      // TODO: Use proper types for this.
      const res = await injectEnvVariables({
        accountSlug,
        baseVariables: config?.env || {},
        envAPI: runtime.env,
        netlifyAPI: config?.api,
        siteID,
      })

      console.log('-> Vars', res)
    }
  }

  async stop() {
    await this.#runtime?.stop()
  }
}
