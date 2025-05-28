import type { Config } from '../../src/lib/config.ts'

export interface AvailableFunction {
  config?: Config
  path: string
}

export type EdgeFunction = { config?: Config; default: (req: Request, context: object) => Promise<Response> }

export interface FunctionMapEntry {}

export interface RunOptions {
  bootstrapURL: string
  denoPort: number
}
