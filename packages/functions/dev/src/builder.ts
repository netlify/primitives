import { MemoizeCache } from '@netlify/dev-utils'
import { ExtendedRoute, FunctionResult, ModuleFormat } from '@netlify/zip-it-and-ship-it'

export interface FunctionBuilder {
  build: ({ cache }: { cache: BuildCache }) => Promise<BuildResult | undefined>
  builderName: string
}

export interface BuildResult {
  buildPath: string
  excludedRoutes?: ExtendedRoute[]
  includedFiles?: string[]
  outputModuleFormat?: ModuleFormat
  mainFile: string
  routes?: ExtendedRoute[]
  runtimeAPIVersion?: number
  srcFiles: string[]
  schedule?: string
  targetDirectory?: string
}

export type BuildCache = MemoizeCache<FunctionResult>
