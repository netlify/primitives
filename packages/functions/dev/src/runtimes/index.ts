import type { HandlerResponse } from '@netlify/functions'
import { FunctionBuilder } from '../builder.js'
import { NetlifyFunction } from '../function.js'
import { nodeJSRuntime } from './nodejs/index.js'

export interface GetBuildFunctionOptions {
  config: any
  directory: string
  func: NetlifyFunction
  projectRoot: string
  targetDirectory: string
}

export interface InvokeFunctionOptions {
  context: any
  environment: any
  func: NetlifyFunction
  request: Request
  route?: string
  timeout: number
}

export interface Runtime {
  getBuildFunction: (options: GetBuildFunctionOptions) => Promise<FunctionBuilder['build']>
  invokeFunction: (options: InvokeFunctionOptions) => Promise<Response>
}

export const runtimes: Record<string, Runtime | undefined> = {
  js: nodeJSRuntime,
}
