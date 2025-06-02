import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Logger, renderFunctionErrorPage, type Geolocation } from '@netlify/dev-utils'
import {
  find,
  generateManifest,
  mergeDeclarations,
  DenoBridge,
  Declaration,
  EdgeFunction,
  FunctionConfig,
} from '@netlify/edge-bundler'
import { getURL as getBootstrapURL } from '@netlify/edge-functions-bootstrap/version'
import { base64Encode } from '@netlify/runtime-utils'
import getAvailablePort from 'get-port'

import type { RunOptions, SerializedError } from '../shared/types.js'
import { headers } from './headers.js'

interface EdgeFunctionsHandlerOptions {
  configDeclarations: Declaration[]
  directories: string[]
  env: Record<string, string>
  geolocation: Geolocation
  logger: Logger
  originServerAddress: string
  requestTimeout?: number
  siteID?: string
  siteName?: string
}

const denoRunPath = path.resolve(fileURLToPath(import.meta.url), '../../deno/server.mjs')
const DENO_SERVER_POLL_INTERVAL = 50
const DENO_SERVER_POLL_TIMEOUT = 3000
const LOCAL_HOST = '127.0.0.1'

// The timeout imposed by the edge nodes. It's important to keep this in place
// as a fallback in case we're unable to patch `fetch` to add our own here.
// https://github.com/netlify/stargate/blob/b5bc0eeb79bbbad3a8a6f41c7c73f1bcbcb8a9c8/proxy/deno/edge.go#L77
const UPSTREAM_REQUEST_TIMEOUT = 37_000

// The overall timeout should be at most the limit imposed by the edge nodes
// minus a buffer that gives us enough time to send back a response.
const REQUEST_TIMEOUT = UPSTREAM_REQUEST_TIMEOUT - 1_000

export class EdgeFunctionsHandler {
  private configDeclarations: Declaration[]
  private directories: string[]
  private geolocation: Geolocation
  private initialization: ReturnType<typeof this.initialize>
  private initialized: boolean
  private logger: Logger
  private originServerAddress: string
  private requestTimeout: number
  private siteID?: string
  private siteName?: string

  constructor(options: EdgeFunctionsHandlerOptions) {
    this.configDeclarations = options.configDeclarations
    this.directories = options.directories
    this.geolocation = options.geolocation
    this.initialization = this.initialize({
      ...options.env,
      DENO_REGION: 'dev',
    })
    this.initialized = false
    this.logger = options.logger
    this.originServerAddress = options.originServerAddress
    this.requestTimeout = options.requestTimeout ?? REQUEST_TIMEOUT
    this.siteID = options.siteID
    this.siteName = options.siteName
  }

  /**
   * Retrieves the in-source configuration objects for a set of edge functions.
   * The evaluation of the functions and the retrieval of the configs must take
   * place in Deno, but all the logic for processing those configurations and
   * merging them with other sources lives in Node.js. To keep a single source
   * of truth, we make a request to the Deno server with a special method that
   * instructs the handler to evaluate the functions and return their configs,
   * which are then returned by this method.
   */
  private async getFunctionConfigs(denoPort: number, functions: Record<string, string>) {
    const url = new URL(`http://${LOCAL_HOST}:${denoPort.toString()}`)
    url.searchParams.set('functions', encodeURIComponent(JSON.stringify(functions)))

    const res = await fetch(url, {
      method: 'NETLIFYCONFIG',
    })
    const data = (await res.json()) as unknown

    if (res.ok) {
      return { configs: data as Record<string, FunctionConfig> }
    }

    return { error: (data as { error: SerializedError }).error }
  }

  /**
   * Returns the list of edge functions that should run for a given request.
   * It computes both the names of the edge functions that should run as well
   * as the invocation metadata object that must be included in the request.
   */
  private getFunctionsForRequest(
    req: Request,
    availableFunctions: EdgeFunction[],
    functionConfigs: Record<string, FunctionConfig>,
  ) {
    const url = new URL(req.url)
    const declarations = mergeDeclarations(this.configDeclarations, functionConfigs, {}, [])
    const { manifest } = generateManifest({
      declarations,
      userFunctionConfig: functionConfigs,
      functions: availableFunctions,
    })
    const matchingFunctionNames: string[] = []
    const routeIndexes: number[] = []
    const routes = [...manifest.routes, ...manifest.post_cache_routes]

    routes.forEach((route, index) => {
      if (route.methods && route.methods.length !== 0 && !route.methods.includes(req.method)) {
        return
      }

      const pattern = new RegExp(route.pattern)
      if (!pattern.test(url.pathname)) {
        return
      }

      const isExcludedForFunction = manifest.function_config[route.function]?.excluded_patterns?.some((pattern) =>
        new RegExp(pattern).test(url.pathname),
      )
      if (isExcludedForFunction) {
        return
      }

      const isExcludedForRoute = route.excluded_patterns.some((pattern) => new RegExp(pattern).test(url.pathname))
      if (isExcludedForRoute) {
        return
      }

      matchingFunctionNames.push(route.function)
      routeIndexes.push(index)
    })

    const invocationMetadata = {
      function_config: manifest.function_config,
      req_routes: routeIndexes,
      routes: routes.map((route) => ({
        function: route.function,
        path: route.path,
        pattern: route.pattern,
      })),
    }

    return { functionNames: matchingFunctionNames, invocationMetadata }
  }

  /**
   * Runs a request through the edge functions handler. The request may or may
   * not match any edge functions: if it does, this method takes ownership of
   * the request and returns the corresponding response; if it doesn't, the
   * method returns `undefined`.
   */
  async handle(request: Request) {
    if (request.headers.has(headers.Passthrough)) {
      return
    }

    const functions = await find(this.directories)
    if (functions.length === 0) {
      return
    }

    const functionsMap = functions.reduce<Record<string, string>>(
      (acc, { name, path }) => ({
        ...acc,
        [name]: pathToFileURL(path).toString(),
      }),
      {},
    )

    const initMessage = setTimeout(() => {
      if (this.initialized) {
        return
      }

      this.logger.log(
        'Setting up the Netlify Edge Functions environment. This may take up to a couple of minutes, depending on your internet connection.',
      )
    }, 5_000)

    const { denoPort, success } = await this.initialization
    if (!success) {
      clearTimeout(initMessage)

      return
    }

    const acceptsHTML = Boolean(request.headers.get('accept')?.includes('text/html'))
    const { configs, error } = await this.getFunctionConfigs(denoPort, functionsMap)
    if (error) {
      return await this.renderError(JSON.stringify({ error }), acceptsHTML)
    }

    const { functionNames, invocationMetadata } = this.getFunctionsForRequest(request, functions, configs)
    if (functionNames.length === 0) {
      return
    }

    const originURL = new URL(this.originServerAddress)

    const url = new URL(request.url)
    url.hostname = LOCAL_HOST
    url.port = denoPort.toString()
    url.protocol = 'http:'

    request.headers.set(headers.AcceptEncoding, 'identity')
    request.headers.set(headers.AvailableFunctions, JSON.stringify(functionsMap))
    request.headers.set(headers.DeployContext, 'dev')
    request.headers.set(headers.DeployID, '0')
    request.headers.set(headers.ForwardedHost, `localhost:${originURL.port}`)
    request.headers.set(headers.ForwardedProtocol, `http:`)
    request.headers.set(headers.Functions, functionNames.join(','))
    request.headers.set(headers.Geo, base64Encode(this.geolocation))
    request.headers.set(headers.InvocationMetadata, base64Encode(invocationMetadata))
    request.headers.set(headers.IP, LOCAL_HOST)
    request.headers.set(headers.Passthrough, 'passthrough')
    request.headers.set(headers.PassthroughHost, `localhost:${originURL.port}`)
    request.headers.set(headers.PassthroughProtocol, 'http:')

    const site = {
      id: this.siteID,
      name: this.siteName,
      url: this.originServerAddress,
    }

    request.headers.set(headers.Site, base64Encode(site))

    // Proxying the request to the Deno server.
    const response = await fetch(url, request)

    const isUncaughtError = response.headers.has(headers.UncaughtError)
    if (isUncaughtError) {
      return await this.renderError(await response.text(), acceptsHTML)
    }

    return response
  }

  /**
   * Initializes the Deno server where the edge functions will run.
   */
  private async initialize(env: Record<string, string>) {
    let success = true

    const processRef = {}

    // If we ran the server on a random port, we wouldn't know how to reach it.
    // Compute the port upfront and pass it on to the server.
    const denoPort = await getAvailablePort()
    const denoBridge = new DenoBridge({
      // TODO: Remove this override once `@netlify/edge-bundler` has been
      // updated to require Deno 2.x.
      versionRange: '^2.2.4',
    })
    const runOptions: RunOptions = {
      bootstrapURL: await getBootstrapURL(),
      denoPort,
      requestTimeout: this.requestTimeout,
    }
    const denoFlags: string[] = ['--allow-scripts', '--quiet', '--no-lock']
    const script = `import('${pathToFileURL(denoRunPath).toString()}?options=${encodeURIComponent(JSON.stringify(runOptions))}');`

    try {
      await denoBridge.runInBackground(['eval', ...denoFlags, script], processRef, {
        env,
        extendEnv: false,
        pipeOutput: true,
      })
    } catch (error) {
      success = false

      this.logger.error('An error occurred while setting up the Netlify Edge Functions environment:', error)
    }

    // The Promise above will resolve as soon as we start the command, but we
    // must wait for it to actually listen for requests.
    await this.waitForDenoServer(denoPort)

    this.initialized = true

    return {
      denoPort,
      success,
    }
  }

  private async renderError(errorBuffer: string, acceptsHTML: boolean): Promise<Response> {
    const status = 500
    const {
      error: { message, name, stack = '' },
    } = JSON.parse(errorBuffer.toString()) as { error: Error }

    if (!acceptsHTML) {
      return new Response(`${name}: ${message}\n ${stack}`, { status })
    }

    const formattedError = JSON.stringify({
      errorType: name,
      errorMessage: message,
      trace: stack.split('\\n'),
    })
    const errorBody = await renderFunctionErrorPage(formattedError, 'edge function')

    return new Response(errorBody, {
      headers: {
        'Content-Type': 'text/html',
      },
      status,
    })
  }

  private async waitForDenoServer(port: number, count = 1): Promise<void> {
    try {
      await fetch(`http://${LOCAL_HOST}:${port.toString()}`, {
        method: 'HEAD',
      })
    } catch {
      if ((count + 1) * DENO_SERVER_POLL_INTERVAL > DENO_SERVER_POLL_TIMEOUT) {
        throw new Error('Could not establish a connection to the Netlify Edge Functions local development server')
      }

      await new Promise((resolve) => setTimeout(resolve, DENO_SERVER_POLL_INTERVAL))

      return this.waitForDenoServer(port, count + 1)
    }
  }
}

export { type Declaration } from '@netlify/edge-bundler'
