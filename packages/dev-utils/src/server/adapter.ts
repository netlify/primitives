import { createServerAdapter } from '@whatwg-node/server'

import { Middleware ,MiddlewareContext, MiddlewareNextFunction} from '../lib/middleware.js'

export class NotFoundResponse extends Response {
  constructor() {
    super(null, { status: 404 })
  }
}

export class Server {
  middlewares: Middleware[]

  constructor() {
    this.middlewares = []
  }

  getServerAdapter() {
    return createServerAdapter((request: Request) => this.handleRequest(request))
  }

  async handleRequestWithMiddleware(request: Request, context: MiddlewareContext, middlewareIndex: number) {
    if (middlewareIndex >= this.middlewares.length) {
      return new NotFoundResponse()
    }

    const nextMiddlewareNextFunction: MiddlewareNextFunction = (request, context) => this.handleRequestWithMiddleware(request, context, middlewareIndex + 1)
    const response = await this.middlewares[middlewareIndex](request, context, nextMiddlewareNextFunction)

    return response ?? new NotFoundResponse()
  }

  handleRequest(request: Request) {
    return this.handleRequestWithMiddleware(request, {}, 0)
  }

  use(middleware: Middleware) {
    this.middlewares.push(middleware)

    return this
  }
}
