export interface RunOptions {
  denoPort: number
  requestTimeout: number
}

export interface SerializedError {
  message: string
  name?: string
  stack?: string
}
