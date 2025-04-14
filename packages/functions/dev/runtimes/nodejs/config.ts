import type { Config as FunctionsConfig, NodeBundlerName } from '@netlify/zip-it-and-ship-it'

// TODO: Import from `@netlify/config`.
export interface TOMLFunctionConfig {
  external_node_modules: string[]
  ignored_node_modules: string[]
  included_files: string[]
  node_bundler: string
  schedule: string
}

interface NormalizeFunctionsConfigOptions {
  functionsConfig: Record<string, TOMLFunctionConfig>
  projectRoot: string
  siteEnv?: Record<string, string>
}

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
export const normalizeFunctionsConfig = ({
  functionsConfig = {},
  projectRoot,
  siteEnv = {},
}: NormalizeFunctionsConfigOptions) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        includedFiles: config.included_files,
        includedFilesBasePath: projectRoot,
        ignoredNodeModules: config.ignored_node_modules,
        nodeBundler: (config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler) as NodeBundlerName,
        nodeVersion: siteEnv.AWS_LAMBDA_JS_RUNTIME,
        processDynamicNodeImports: true,
        schedule: config.schedule,
        zipGo: true,
      },
    }),
    {} as FunctionsConfig,
  )
