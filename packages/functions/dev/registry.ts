import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, extname, isAbsolute, join, resolve } from 'node:path'
import { env } from 'node:process'

import type { EnvironmentContext as BlobsContext } from '@netlify/blobs'
import { DevEventHandler, watchDebounced } from '@netlify/dev-utils'
import { ListedFunction, listFunctions, Manifest } from '@netlify/zip-it-and-ship-it'
import extractZip from 'extract-zip'

import type {
  FunctionBuildErrorEvent,
  FunctionExtractedEvent,
  FunctionLoadedEvent,
  FunctionMissingTypesPackageEvent,
  FunctionNotInvokableOnPathEvent,
  FunctionRegisteredEvent,
  FunctionReloadingEvent,
  FunctionRemovedEvent,
} from './events.js'

import { BuildCache } from './builder.js'
import { NetlifyFunction } from './function.js'
import { runtimes } from './runtimes/index.js'

export const DEFAULT_FUNCTION_URL_EXPRESSION = /^\/.netlify\/(functions|builders)\/([^/]+).*/
const TYPES_PACKAGE = '@netlify/functions'

export interface FunctionRegistryOptions {
  blobsContext?: BlobsContext
  destPath: string
  config: any
  debug?: boolean
  eventHandler?: DevEventHandler
  frameworksAPIFunctionsPath?: string
  internalFunctionsPath?: string
  manifest?: Manifest
  projectRoot: string
  settings: any
  timeouts: any
  watch?: boolean
}

export class FunctionsRegistry {
  /**
   * Context object for Netlify Blobs
   */
  private blobsContext?: BlobsContext

  /**
   * The functions held by the registry
   */
  private functions = new Map<string, NetlifyFunction>()

  /**
   * File watchers for function files. Maps function names to objects built
   * by the `watchDebounced` utility.
   */
  private functionWatchers = new Map<string, Awaited<ReturnType<typeof watchDebounced>>>()

  /**
   * Keeps track of whether we've checked whether `TYPES_PACKAGE` is
   * installed.
   */
  private hasCheckedTypesPackage = false

  private buildCache: BuildCache
  private config: any
  private debug: boolean
  private destPath: string
  private directoryWatchers: Map<string, Awaited<ReturnType<typeof watchDebounced>>>
  private handleEvent: DevEventHandler
  private frameworksAPIFunctionsPath?: string
  private internalFunctionsPath?: string
  private manifest?: Manifest
  private projectRoot: string
  private timeouts: any
  private settings: any
  private watch: boolean

  constructor({
    blobsContext,
    config,
    debug = false,
    destPath,
    eventHandler,
    frameworksAPIFunctionsPath,
    internalFunctionsPath,
    manifest,
    projectRoot,
    settings,
    timeouts,
    watch,
  }: FunctionRegistryOptions) {
    this.blobsContext = blobsContext
    this.config = config
    this.debug = debug
    this.destPath = destPath
    this.frameworksAPIFunctionsPath = frameworksAPIFunctionsPath
    this.handleEvent = eventHandler ?? (() => {})
    this.internalFunctionsPath = internalFunctionsPath
    this.projectRoot = projectRoot
    this.timeouts = timeouts
    this.settings = settings
    this.watch = watch === true

    /**
     * An object to be shared among all functions in the registry. It can be
     * used to cache the results of the build function — e.g. it's used in
     * the `memoizedBuild` method in the JavaScript runtime.
     */
    this.buildCache = {}

    /**
     * File watchers for parent directories where functions live — i.e. the
     * ones supplied to `scan()`. This is a Map because in the future we
     * might have several function directories.
     */
    this.directoryWatchers = new Map()

    /**
     * Contents of a `manifest.json` file that can be looked up when dealing
     * with built functions.
     */
    this.manifest = manifest
  }

  async checkTypesPackage() {
    if (this.hasCheckedTypesPackage) {
      return
    }

    this.hasCheckedTypesPackage = true

    const require = createRequire(this.projectRoot)

    try {
      require.resolve(TYPES_PACKAGE, { paths: [this.projectRoot] })
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') {
        this.handleEvent({ name: 'FunctionMissingTypesPackageEvent' } as FunctionMissingTypesPackageEvent)
      }
    }
  }

  /**
   * Builds a function and sets up the appropriate file watchers so that any
   * changes will trigger another build.
   */
  async buildFunctionAndWatchFiles(func: NetlifyFunction, firstLoad = false) {
    if (!firstLoad) {
      this.handleEvent({ function: func, name: 'FunctionReloadingEvent' } as FunctionReloadingEvent)
    }

    const { error: buildError, includedFiles, srcFilesDiff } = await func.build({ cache: this.buildCache })

    if (buildError) {
      this.handleEvent({ function: func, name: 'FunctionBuildErrorEvent' } as FunctionBuildErrorEvent)
    } else {
      this.handleEvent({ firstLoad, function: func, name: 'FunctionLoadedEvent' } as FunctionLoadedEvent)
    }

    if (func.isTypeScript()) {
      this.checkTypesPackage()
    }

    // If the build hasn't resulted in any files being added or removed, there
    // is nothing else we need to do.
    if (!srcFilesDiff) {
      return
    }

    if (!this.watch) {
      return
    }

    const watcher = this.functionWatchers.get(func.name)

    // If there is already a watcher for this function, we need to unwatch any
    // files that have been removed and watch any files that have been added.
    if (watcher) {
      srcFilesDiff.deleted.forEach((path) => {
        watcher.unwatch(path)
      })

      srcFilesDiff.added.forEach((path) => {
        watcher.add(path)
      })

      return
    }

    // If there is no watcher for this function but the build produced files,
    // we create a new watcher and watch them.
    if (srcFilesDiff.added.size !== 0) {
      const filesToWatch = [...srcFilesDiff.added, ...includedFiles]
      const newWatcher = await watchDebounced(filesToWatch, {
        onChange: () => {
          this.buildFunctionAndWatchFiles(func, false)
        },
      })

      this.functionWatchers.set(func.name, newWatcher)
    }
  }

  set eventHandler(handler: DevEventHandler) {
    this.handleEvent = handler
  }

  /**
   * Returns a function by name.
   */
  get(name: string) {
    return this.functions.get(name)
  }

  /**
   * Looks for the first function that matches a given URL path. If a match is
   * found, returns an object with the function and the route. If the URL path
   * matches the default functions URL (i.e. can only be for a function) but no
   * function with the given name exists, returns an object with the function
   * and the route set to `null`. Otherwise, `undefined` is returned,
   */
  async getFunctionForURLPath(urlPath: string, method: string) {
    // We're constructing a URL object just so that we can extract the path from
    // the incoming URL. It doesn't really matter that we don't have the actual
    // local URL with the correct port.
    const url = new URL(`http://localhost${urlPath}`)
    const defaultURLMatch = url.pathname.match(DEFAULT_FUNCTION_URL_EXPRESSION)

    if (defaultURLMatch) {
      const func = this.get(defaultURLMatch[2])

      if (!func) {
        return { func: null, route: null }
      }

      const { routes = [] } = func

      if (routes.length !== 0) {
        this.handleEvent({
          function: func,
          name: 'FunctionNotInvokableOnPathEvent',
          urlPath,
        } as FunctionNotInvokableOnPathEvent)

        return
      }

      return { func, route: null }
    }

    for (const func of this.functions.values()) {
      const route = await func.matchURLPath(url.pathname, method)

      if (route) {
        return { func, route }
      }
    }
  }

  isInternalFunction(func: ListedFunction | NetlifyFunction) {
    if (this.internalFunctionsPath && func.mainFile.includes(this.internalFunctionsPath)) {
      return true
    }

    if (this.frameworksAPIFunctionsPath && func.mainFile.includes(this.frameworksAPIFunctionsPath)) {
      return true
    }

    return false
  }

  /**
   * Adds a function to the registry
   */
  async registerFunction(name: string, func: NetlifyFunction, isReload = false) {
    this.handleEvent({ function: func, name: 'FunctionRegisteredEvent' } as FunctionRegisteredEvent)

    // If the function file is a ZIP, we extract it and rewire its main file to
    // the new location.
    if (extname(func.mainFile) === '.zip') {
      const unzippedDirectory = await this.unzipFunction(func)

      // If there's a manifest file, look up the function in order to extract
      // the build data.
      const manifestEntry = (this.manifest?.functions || []).find((manifestFunc) => manifestFunc.name === func.name)

      // We found a zipped function that does not have a corresponding entry in
      // the manifest. This shouldn't happen, but we ignore the function in
      // this case.
      if (!manifestEntry) {
        return
      }

      if (this.debug) {
        this.handleEvent({ function: func, name: 'FunctionExtractedEvent' } as FunctionExtractedEvent)
      }

      func.setRoutes(manifestEntry?.routes)

      // When we look at an unzipped function, we don't know whether it uses
      // the legacy entry file format (i.e. `[function name].mjs`) or the new
      // one (i.e. `___netlify-entry-point.mjs`). Let's look for the new one
      // and use it if it exists, otherwise use the old one.
      try {
        const v2EntryPointPath = join(unzippedDirectory, '___netlify-entry-point.mjs')

        await stat(v2EntryPointPath)

        func.mainFile = v2EntryPointPath
      } catch {
        func.mainFile = join(unzippedDirectory, basename(manifestEntry.mainFile))
      }
    } else if (this.watch) {
      this.buildFunctionAndWatchFiles(func, !isReload)
    }

    this.functions.set(name, func)
  }

  /**
   * A proxy to zip-it-and-ship-it's `listFunctions` method. It exists just so
   * that we can mock it in tests.
   */
   
  async listFunctions(...args: Parameters<typeof listFunctions>) {
    return await listFunctions(...args)
  }

  /**
   * Takes a list of directories and scans for functions. It keeps tracks of
   * any functions in those directories that we've previously seen, and takes
   * care of registering and unregistering functions as they come and go.
   */
  async scan(relativeDirs: (string | undefined)[]) {
    const directories = relativeDirs
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => (isAbsolute(dir) ? dir : join(this.projectRoot, dir)))

    // check after filtering to filter out [undefined] for example
    if (directories.length === 0) {
      return
    }

    const functions = await this.listFunctions(directories, {
      featureFlags: {
        buildRustSource: env.NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE === 'true',
      },
      configFileDirectories: [this.internalFunctionsPath].filter(Boolean) as string[],
      config: this.config.functions,
      parseISC: true,
    })

    // user-defined functions take precedence over internal functions,
    // so we want to ignore any internal functions where there's a user-defined one with the same name
    const ignoredFunctions = new Set(
      functions
        .filter(
          (func) =>
            this.isInternalFunction(func) &&
            this.functions.has(func.name) &&
            !this.isInternalFunction(this.functions.get(func.name)!),
        )
        .map((func) => func.name),
    )

    // Before registering any functions, we look for any functions that were on
    // the previous list but are missing from the new one. We unregister them.
    const deletedFunctions = [...this.functions.values()].filter((oldFunc) => {
      const isFound = functions.some(
        (newFunc) =>
          ignoredFunctions.has(newFunc.name) ||
          (newFunc.name === oldFunc.name && newFunc.mainFile === oldFunc.mainFile),
      )

      return !isFound
    })

    await Promise.all(deletedFunctions.map((func) => this.unregisterFunction(func)))

    const deletedFunctionNames = new Set(deletedFunctions.map((func) => func.name))
    const addedFunctions = await Promise.all(
      // zip-it-and-ship-it returns an array sorted based on which extension should have precedence,
      // where the last ones precede the previous ones. This is why
      // we reverse the array so we get the right functions precedence in the CLI.
      functions.reverse().map(async ({ displayName, excludedRoutes, mainFile, name, routes, runtime: runtimeName }) => {
        if (ignoredFunctions.has(name)) {
          return
        }

        const runtime = runtimes[runtimeName]

        // If there is no matching runtime, it means this function is not yet
        // supported in Netlify Dev.
        // TODO: Add callback for other runtimes.
        if (runtime === undefined) {
          return
        }

        // If this function has already been registered, we skip it.
        if (this.functions.has(name)) {
          return
        }

        const directory = directories.find((directory) => mainFile.startsWith(directory))

        if (directory === undefined) {
          return
        }

        const func = new NetlifyFunction({
          blobsContext: this.blobsContext,
          config: this.config,
          directory,
          displayName,
          excludedRoutes,
          mainFile,
          name,
          projectRoot: this.projectRoot,
          routes,
          runtime,
          settings: this.settings,
          targetDirectory: this.destPath,
          timeoutBackground: this.timeouts.backgroundFunctions,
          timeoutSynchronous: this.timeouts.syncFunctions,
        })

        // If a function we're registering was also unregistered in this run,
        // then it was a rename. Let's flag it as such so that the messaging
        // is adjusted accordingly.
        const isReload = deletedFunctionNames.has(name)

        await this.registerFunction(name, func, isReload)

        return func
      }),
    )
    const addedFunctionNames = new Set(addedFunctions.filter(Boolean).map((func) => func?.name))

    deletedFunctions.forEach(async (func) => {
      // If a function we've unregistered was also registered in this run, then
      // it was a rename that we've already logged. Nothing to do in this case.
      if (addedFunctionNames.has(func.name)) {
        return
      }

      this.handleEvent({ function: func, name: 'FunctionRemovedEvent' } as FunctionRemovedEvent)
    })

    if (this.watch) {
      await Promise.all(directories.map((path) => this.setupDirectoryWatcher(path)))
    }
  }

  /**
   * Creates a watcher that looks at files being added or removed from a
   * functions directory. It doesn't care about files being changed, because
   * those will be handled by each functions' watcher.
   */
  async setupDirectoryWatcher(directory: string) {
    if (this.directoryWatchers.has(directory)) {
      return
    }

    const watcher = await watchDebounced(directory, {
      depth: 1,
      onAdd: () => {
        this.scan([directory])
      },
      onUnlink: () => {
        this.scan([directory])
      },
    })

    this.directoryWatchers.set(directory, watcher)
  }

  /**
   * Removes a function from the registry and closes its file watchers.
   */
  async unregisterFunction(func: NetlifyFunction) {
    const { name } = func

    this.functions.delete(name)

    const watcher = this.functionWatchers.get(name)

    if (watcher) {
      await watcher.close()
    }

    this.functionWatchers.delete(name)
  }

  /**
   * Takes a zipped function and extracts its contents to an internal directory.
   */
  async unzipFunction(func: NetlifyFunction) {
    const targetDirectory = resolve(this.projectRoot, this.destPath, '.unzipped', func.name)

    await extractZip(func.mainFile, { dir: targetDirectory })

    return targetDirectory
  }
}
