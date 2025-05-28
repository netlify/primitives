import type { Config } from '../../src/lib/config.ts'

export type EdgeFunction = { config?: Config; default: (req: Request, context: object) => Promise<Response> }

export interface RunOptions {
  bootstrapURL: string
  denoPort: number
}
