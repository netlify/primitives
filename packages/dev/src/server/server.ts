import { isBasicMiddleware, Middleware, MiddlewareContext, MiddlewareHandler,MiddlewareNextFunction} from '../lib/middleware.js'
import { DevEvent, DevEventHandler } from '../main.js'

export class NotFoundResponse extends Response {
  constructor() {
    super(null, { status: 404 })
  }
}

/**
 * A cross-runtime server with support for middleware.
 */
export class Server {
  eventSubscribers: Record<string, DevEventHandler[]>
  middlewares: MiddlewareHandler[]

  constructor() {
    this.eventSubscribers = {}
    this.middlewares = []
  }

  private handleBroadcast(event: DevEvent) {
    const eventName = event.constructor.name
    const subscribers = [...(this.eventSubscribers[eventName] ?? []), ...(this.eventSubscribers["*"] ?? [])]

    for (const subscriber of subscribers) {
      subscriber(event)
    }
  }

  private handleSubscription(eventNames: string[], handler: DevEventHandler) {
    for (const eventName of eventNames) {
      this.eventSubscribers[eventName] = [...(this.eventSubscribers[eventName] ?? []), handler]
    }
  }

  private async handleRequestWithMiddleware(request: Request, context: MiddlewareContext, middlewareIndex: number) {
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

  on(eventNames: string[], handler: DevEventHandler) {
    this.handleSubscription(eventNames, handler)
  }

  use(middleware: Middleware) {
    if (isBasicMiddleware(middleware)) {
      this.middlewares.push(middleware)
    } else {
      this.middlewares.push(middleware.handle)

      if (typeof middleware.init === "function") {
        middleware.init({
          broadcast: (event: DevEvent) => this.handleBroadcast(event),
          subscribe: (eventNames: string[], handler: DevEventHandler) => this.handleSubscription(eventNames, handler)
        })
      }
    }

    return this
  }
}
