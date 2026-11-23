import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FileWatcher,
  type FileWatchSubscriptionHandle,
  type Logger,
  renderFunctionErrorPage,
  killProcess,
  type Geolocation,
  type ProcessRef,
} from '@netlify/dev-utils'
import {
  find,
  generateManifest,
  mergeDeclarations,
  DenoBridge,
  Declaration,
  EdgeFunction,
  FunctionConfig,
} from '@netlify/edge-bundler'
import { base64Encode } from '@netlify/runtime-utils'
import getAvailablePort from 'get-port'

import type { RunOptions, SerializedError } from '../shared/types.js'
import { headers } from './headers.js'

interface EdgeFunctionsHandlerOptions {
  configDeclarations: Declaration[]
  directories: string[]
  env: Record<string, string>
  /**
   * Watches the edge function directories and the local files that the
   * functions import, so that we know when to extract the function configs
   * again. If not set, the handler creates its own.
   */
  fileWatcher?: FileWatcher
  geolocation: Geolocation
  logger: Logger
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

export type EdgeFunctionsMatch = Awaited<ReturnType<EdgeFunctionsHandler['getFunctionsForRequest']>>

type FunctionConfigsResult = Awaited<ReturnType<EdgeFunctionsHandler['getFunctionConfigs']>>

export class EdgeFunctionsHandler {
  private configDeclarations: Declaration[]
  private denoServerProcess?: ProcessRef
  private directories: string[]
  private dependencies = new Set<string>()
  private dependenciesWatch?: FileWatchSubscriptionHandle
  private directoriesWatch: FileWatchSubscriptionHandle
  private fileWatcher: FileWatcher
  private functionConfigs?: { key: string; result: Promise<FunctionConfigsResult> }
  private ownFileWatcher?: FileWatcher
  private geolocation: Geolocation
  private initialization: ReturnType<typeof this.initialize>
  private initialized: boolean
  private stopped: boolean
  private logger: Logger

  /**
   * The config errors that we logged, by function name. We log an error again
   * only if it changes, because each request can extract the configs again
   * while a function is broken.
   */
  private loggedConfigErrors = new Map<string, string>()
  private requestTimeout: number
  private siteID?: string
  private siteName?: string

  constructor(options: EdgeFunctionsHandlerOptions) {
    this.configDeclarations = options.configDeclarations
    this.directories = options.directories

    this.fileWatcher = options.fileWatcher ?? new FileWatcher()
    if (!options.fileWatcher) {
      this.ownFileWatcher = this.fileWatcher
    }

    // A change to any file in the edge function directories can change a
    // config, so the next request extracts the configs again.
    this.directoriesWatch = this.fileWatcher.subscribe({
      paths: this.directories,
      onAdd: this.clearFunctionConfigs,
      onChange: this.clearFunctionConfigs,
      onUnlink: this.clearFunctionConfigs,
    })
    this.geolocation = options.geolocation
    this.initialization = this.initialize({
      ...options.env,
      DENO_REGION: 'dev',
    })
    this.initialized = false
    this.stopped = false
    this.logger = options.logger
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
      const { configs, dependencies, errors } = data as {
        configs: Record<string, FunctionConfig>
        dependencies: string[]
        errors: Record<string, SerializedError>
      }

      return { configs, dependencies: dependencies.map((url) => fileURLToPath(url)), errors }
    }

    // The extraction failed as a whole, so we have no configs and no
    // function to blame.
    return { configs: {}, dependencies: [], errors: { '': (data as { error: SerializedError }).error } }
  }

  /**
   * Logs each config error that we did not log before.
   */
  private logConfigErrors(errors: Record<string, SerializedError>) {
    for (const name of this.loggedConfigErrors.keys()) {
      if (!(name in errors)) {
        this.loggedConfigErrors.delete(name)
      }
    }

    for (const [name, error] of Object.entries(errors)) {
      if (this.loggedConfigErrors.get(name) === error.message) {
        continue
      }

      this.loggedConfigErrors.set(name, error.message)
      this.logger.error(error.message)
    }
  }

  /**
   * Returns the configs for a set of edge functions. To extract the configs,
   * Deno must import each function, which is slow. The dev server can get many
   * requests for each page load, so we keep the result until a function file
   * changes or the set of functions changes.
   */
  private getCachedFunctionConfigs(denoPort: number, functions: Record<string, string>) {
    const key = JSON.stringify(functions)
    let entry = this.functionConfigs

    if (entry?.key !== key) {
      const result = this.getFunctionConfigs(denoPort, functions)
      const newEntry = { key, result }

      entry = newEntry
      this.functionConfigs = newEntry

      // An error can have a temporary cause, such as a remote import that is
      // not available. Do not keep it, so that the next request tries again.
      const clearOnError = () => {
        if (this.functionConfigs === newEntry) {
          this.functionConfigs = undefined
        }
      }

      result.then(({ dependencies, errors }) => {
        if (Object.keys(errors).length !== 0) {
          clearOnError()
        } else if (this.functionConfigs === newEntry) {
          this.watchDependencies(dependencies)
        }
      }, clearOnError)
    }

    return entry.result
  }

  private clearFunctionConfigs = () => {
    this.functionConfigs = undefined
  }

  /**
   * Watches the files that the functions import, so that a change to a module
   * outside the edge function directories also clears the cached configs.
   */
  private watchDependencies(paths: string[]) {
    const dependencies = new Set(
      paths.filter((dependency) =>
        this.directories.every((directory) => path.relative(directory, dependency).startsWith('..')),
      ),
    )

    if (
      dependencies.size === this.dependencies.size &&
      [...dependencies].every((dependency) => this.dependencies.has(dependency))
    ) {
      return
    }

    this.dependencies = dependencies
    this.dependenciesWatch?.unsubscribe()
    this.dependenciesWatch =
      dependencies.size === 0
        ? undefined
        : this.fileWatcher.subscribe({
            paths: [...dependencies],
            onChange: this.clearFunctionConfigs,
            onUnlink: this.clearFunctionConfigs,
          })
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

      if (route.headers) {
        const headerMatches = Object.entries(route.headers).every(([headerName, headerMatch]) => {
          const requestHeaderValue = req.headers.get(headerName)

          if (headerMatch?.matcher === 'exists') {
            return requestHeaderValue !== null
          }

          if (headerMatch?.matcher === 'missing') {
            return requestHeaderValue === null
          }

          if (requestHeaderValue && headerMatch?.matcher === 'regex') {
            const pattern = new RegExp(headerMatch.pattern)

            return pattern.test(requestHeaderValue.split(', ').join(','))
          }

          return false
        })

        if (!headerMatches) {
          return
        }
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
  async match(request: Request) {
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
    const { configs, errors } = await this.getCachedFunctionConfigs(denoPort, functionsMap)

    // A function that did not load must not stop the other functions, or the
    // requests that no function matches. We log its error and continue
    // without its in-source config.
    this.logConfigErrors(errors)

    const { functionNames, invocationMetadata } = this.getFunctionsForRequest(request, functions, configs)
    if (functionNames.length === 0) {
      return
    }

    // A declaration in `netlify.toml` can route the request to a function that
    // did not load. Show the error of that function.
    const brokenFunction = functionNames.find((name) => name in errors)
    if (brokenFunction) {
      return { handle: () => this.renderError(JSON.stringify({ error: errors[brokenFunction] }), acceptsHTML) }
    }

    return {
      handle: async (request: Request, originServerAddress: string) => {
        const originURL = new URL(originServerAddress)

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
          url: originServerAddress,
        }

        request.headers.set(headers.Site, base64Encode(site))

        // Proxying the request to the Deno server.
        const response = await fetch(url, request)

        const isUncaughtError = response.headers.has(headers.UncaughtError)
        if (isUncaughtError) {
          return await this.renderError(await response.text(), acceptsHTML)
        }

        return response
      },
    }
  }

  /**
   * Initializes the Deno server where the edge functions will run.
   */
  private async initialize(env: Record<string, string>) {
    let success = true

    const processRef: ProcessRef = {}
    this.denoServerProcess = processRef

    // If we ran the server on a random port, we wouldn't know how to reach it.
    // Compute the port upfront and pass it on to the server.
    const denoPort = await getAvailablePort()
    const denoBridge = new DenoBridge({
      // TODO: Remove this override once `@netlify/edge-bundler` has been
      // updated to require Deno 2.x.
      versionRange: '^2.2.4',
    })
    const runOptions: RunOptions = {
      denoPort,
      requestTimeout: this.requestTimeout,
    }
    const denoFlags: string[] = ['--allow-scripts', '--quiet', '--no-lock']
    const script = `import('${pathToFileURL(denoRunPath).toString()}');`

    try {
      await denoBridge.runInBackground(['eval', ...denoFlags, script, JSON.stringify(runOptions)], processRef, {
        env,
        extendEnv: false,
        pipeOutput: true,
      })
      if (this.stopped) {
        await killProcess(processRef.ps)
        this.denoServerProcess = undefined
        success = false
      }
    } catch (error) {
      success = false

      this.logger.error(`An error occurred while setting up the Netlify Edge Functions environment: ${String(error)}`)
    }

    if (success) {
      // The Promise above will resolve as soon as we start the command, but we
      // must wait for it to actually listen for requests.
      await this.waitForDenoServer(denoPort)
    }

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
    } = JSON.parse(errorBuffer) as { error: Error }

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
      // If we've already stopped the server, swallow the error.
      if (!this.denoServerProcess) {
        return
      }

      if ((count + 1) * DENO_SERVER_POLL_INTERVAL > DENO_SERVER_POLL_TIMEOUT) {
        throw new Error('Could not establish a connection to the Netlify Edge Functions local development server')
      }

      await new Promise((resolve) => setTimeout(resolve, DENO_SERVER_POLL_INTERVAL))

      return this.waitForDenoServer(port, count + 1)
    }
  }

  async stop() {
    if (this.stopped) return
    this.stopped = true

    this.directoriesWatch.unsubscribe()
    this.dependenciesWatch?.unsubscribe()
    await this.ownFileWatcher?.close()

    if (!this.denoServerProcess?.ps) {
      return
    }

    const { ps } = this.denoServerProcess

    this.denoServerProcess = undefined

    try {
      await killProcess(ps)
    } catch {}
  }
}

export { type Declaration } from '@netlify/edge-bundler'
