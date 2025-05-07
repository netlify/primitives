import { Cookies } from './cookies.js'
import { Geo } from './geo.js'
import { Server } from './server.js'
import { Site } from './site.js'

interface NextOptions {
  sendConditionalRequest?: boolean
}

export interface Context {
  account: {
    id: string
  }
  cookies: Cookies
  deploy: {
    context: string
    id: string
    published: boolean
  }
  geo: Geo
  ip: string
  json: (input: unknown) => Response
  log: {
    (...data: any[]): void
    (message?: any, ...optionalParams: any[]): void
  }
  next(options?: NextOptions): Promise<Response>

  /**
   * @param request `Request` to be passed down the request chain. Defaults to the original `request` object passed into the Edge Function.
   */
  next(request: Request, options?: NextOptions): Promise<Response>

  params: Record<string, string>

  /**
   * @deprecated Use a `URL` object instead: https://ntl.fyi/edge-rewrite
   */
  rewrite(url: string | URL): Promise<Response>

  requestId: string
  server: Server
  site: Site
  url: URL
  waitUntil: (promise: Promise<unknown>) => void
}
