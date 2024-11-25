import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { memoize } from '@netlify/dev-utils'
import { zipFunction, listFunction, ArchiveFormat, Config as FunctionsConfig } from '@netlify/zip-it-and-ship-it'
import { FeatureFlags } from '@netlify/zip-it-and-ship-it/dist/feature_flags.js'
import decache from 'decache'
import { readPackageUp } from 'read-package-up'
import sourceMapSupport from 'source-map-support'

import { normalizeFunctionsConfig, TOMLFunctionConfig } from './config.js'
import { NetlifyFunction } from '../../function.js'

import { BuildCache, BuildResult, FunctionBuilder } from '../../builder.js'

const require = createRequire(import.meta.url)

const serveFunctionsFolder = path.join('.netlify', 'functions-serve')

const addFunctionsConfigDefaults = (config: FunctionsConfig): FunctionsConfig => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

interface BuildFunctionOptions {
  cache: BuildCache
  config: FunctionsConfig
  directory: string
  featureFlags: Record<string, boolean>
  func: NetlifyFunction
  hasTypeModule: boolean
  projectRoot: string
  targetDirectory: string
}

const buildFunction = async ({
  cache,
  config,
  directory,
  featureFlags,
  func,
  hasTypeModule,
  projectRoot,
  targetDirectory,
}: BuildFunctionOptions) => {
  const zipOptions = {
    archiveFormat: 'none' as ArchiveFormat,
    basePath: projectRoot,
    config,
    featureFlags: { ...featureFlags, zisi_functions_api_v2: true } as FeatureFlags,
  }
  const functionDirectory = path.dirname(func.mainFile)

  // If we have a function at `functions/my-func/index.js` and we pass
  // that path to `zipFunction`, it will lack the context of the whole
  // functions directory and will infer the name of the function to be
  // `index`, not `my-func`. Instead, we need to pass the directory of
  // the function. The exception is when the function is a file at the
  // root of the functions directory (e.g. `functions/my-func.js`). In
  // this case, we use `mainFile` as the function path of `zipFunction`.
  const entryPath = functionDirectory === directory ? func.mainFile : functionDirectory
  const buildResult = await memoize({
    cache,
    cacheKey: `zisi-${entryPath}`,
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })

  if (!buildResult) {
    return
  }

  const {
    entryFilename,
    excludedRoutes,
    includedFiles,
    inputs,
    mainFile,
    outputModuleFormat,
    path: functionPath,
    routes,
    runtimeAPIVersion,
    schedule,
  } = buildResult
  const srcFiles = (inputs ?? []).filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, entryFilename)

  // some projects include a package.json with "type=module", forcing Node to interpret every descending file
  // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
  if (hasTypeModule) {
    await writeFile(
      path.join(functionPath, `package.json`),
      JSON.stringify({
        type: 'commonjs',
      }),
    )
  }

  clearFunctionsCache(targetDirectory)

  return {
    buildPath,
    excludedRoutes,
    includedFiles,
    outputModuleFormat,
    mainFile,
    routes,
    runtimeAPIVersion,
    srcFiles,
    schedule,
  }
}

interface ParseFunctionForMetadataOptions {
  config: any
  mainFile: string
  projectRoot: string
}

export const parseFunctionForMetadata = async ({ config, mainFile, projectRoot }: ParseFunctionForMetadataOptions) =>
  await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig(config.functions, projectRoot),
    featureFlags: { zisi_functions_api_v2: true } as FeatureFlags,
    parseISC: true,
  })

// Clears the cache for any files inside the directory from which functions are
// served.
const clearFunctionsCache = (functionsPath: string) => {
  Object.keys(require.cache)
    .filter((key) => key.startsWith(functionsPath))
    .forEach(decache)
}

const getTargetDirectory = async (projectRoot: string) => {
  const targetDirectory = path.resolve(projectRoot, serveFunctionsFolder)

  try {
    await mkdir(targetDirectory, { recursive: true })
  } catch {
    throw new Error(`Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

const netlifyConfigToZisiConfig = (functionsConfig: Record<string, TOMLFunctionConfig>, projectRoot: string) =>
  addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig, projectRoot }))

interface HandlerOptions {
  config: any
  directory: string
  func: NetlifyFunction
  metadata: any
  projectRoot: string
}

export const getNoopBuilder = async ({ directory, func, metadata }: HandlerOptions): Promise<FunctionBuilder> => {
  const functionDirectory = path.dirname(func.mainFile)
  const srcFiles = functionDirectory === directory ? [func.mainFile] : [functionDirectory]
  const build = async () =>
    ({
      buildPath: '',
      excludedRoutes: [],
      includedFiles: [],
      mainFile: func.mainFile,
      outputModuleFormat: 'cjs',
      routes: [],
      runtimeAPIVersion: func.runtimeAPIVersion,
      schedule: metadata.schedule,
      srcFiles,
    }) as BuildResult

  return {
    build,
    builderName: '',
    target: '',
  }
}

export const getZISIBuilder = async ({
  config,
  directory,
  func,
  metadata,
  projectRoot,
}: HandlerOptions): Promise<FunctionBuilder | null> => {
  const functionsConfig = netlifyConfigToZisiConfig(config.functions, projectRoot)
  const packageJson = await readPackageUp({ cwd: path.dirname(func.mainFile) })
  const hasTypeModule = Boolean(packageJson && packageJson.packageJson.type === 'module')
  const featureFlags: FeatureFlags = {}

  if (metadata.runtimeAPIVersion === 2) {
    featureFlags.zisi_pure_esm = true
    featureFlags.zisi_pure_esm_mjs = true
  } else {
    // We must use esbuild for certain file extensions.
    const mustTranspile = ['.mjs', '.ts', '.mts', '.cts'].includes(path.extname(func.mainFile))
    const mustUseEsbuild = hasTypeModule || mustTranspile

    if (mustUseEsbuild && !functionsConfig['*'].nodeBundler) {
      functionsConfig['*'].nodeBundler = 'esbuild'
    }

    // TODO: Resolve functions config globs so that we can check for the bundler
    // on a per-function basis.
    const { nodeBundler } = functionsConfig['*']
    const isUsingEsbuild = nodeBundler === 'esbuild_zisi' || nodeBundler === 'esbuild'

    if (!isUsingEsbuild) {
      return null
    }
  }

  // Enable source map support.
  sourceMapSupport.install()

  const targetDirectory = await getTargetDirectory(projectRoot)

  return {
    build: ({ cache = {} }: { cache?: BuildCache }) =>
      buildFunction({
        cache,
        config: functionsConfig,
        directory,
        func,
        projectRoot,
        targetDirectory,
        hasTypeModule,
        featureFlags,
      }),
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}
