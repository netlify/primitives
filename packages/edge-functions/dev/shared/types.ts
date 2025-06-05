export interface RunOptions {
  bootstrapURL: string
  denoPort: number
  requestTimeout: number
}

export interface SerializedError {
  message: string
  name?: string
  stack?: string
}
