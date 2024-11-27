import { DevEvent, DevEventHandler } from "./event.js"

export interface MiddlewareContext {
  config?: any
}

export type MiddlewareNextFunction = (request: Request, context: MiddlewareContext) => Promise<Response | undefined>

export type MiddlewareHandler = (
  request: Request,
  context: MiddlewareContext,
  next: MiddlewareNextFunction,
) => Response | undefined | Promise<Response | undefined>

export interface MiddlewareInitFunctionOptions {
  broadcast: (event: DevEvent) => void
  subscribe: (eventNames: string[], callback: DevEventHandler) => void
}

export type Middleware = MiddlewareHandler | {
  handle: MiddlewareHandler
  init?: (options: MiddlewareInitFunctionOptions) => void
}

export const isBasicMiddleware = (middleware: Middleware): middleware is MiddlewareHandler => typeof middleware === "function"