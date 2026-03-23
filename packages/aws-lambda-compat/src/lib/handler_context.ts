// From https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html.
export interface HandlerContext {
  callbackWaitsForEmptyEventLoop: boolean
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: string
  awsRequestId: string
  logGroupName: string
  logStreamName: string
  identity?: Record<string, unknown>
  clientContext?: Record<string, unknown>

  getRemainingTimeInMillis(): number

  /** @deprecated Use handler callback or promise result */
  done(error?: Error, result?: unknown): void
  /** @deprecated Use handler callback with first argument or reject a promise result */
  fail(error: Error | string): void
  /** @deprecated Use handler callback with second argument or resolve a promise result */
  succeed(messageOrObject: unknown): void
  /** @deprecated Use handler callback or promise result */
  succeed(message: string, object: unknown): void
}
