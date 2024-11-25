export interface MiddlewareContext {
  config?: any
}

export type MiddlewareNextFunction = (request: Request, context: MiddlewareContext) => Promise<Response | undefined>

export type Middleware = (
  request: Request,
  context: MiddlewareContext,
  next: MiddlewareNextFunction,
) => Promise<Response | undefined>
