import type { IncomingHttpHeaders } from 'http'
import { isDeepStrictEqual } from 'util'

import { HTTPServer } from '@netlify/dev-utils'

export interface Route {
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' | 'HEAD' | 'OPTIONS' | 'all'
  path: string
  response?: ((req: Request, res: Response) => Promise<Response> | Response) | Record<string, unknown> | unknown[]
  requestBody?: any
  status?: number
}

interface MockApiOptions {
  routes: Route[]
  silent?: boolean
}

export interface MockApi {
  apiUrl: string
  clearRequests: () => void
  requests: { path: string; body: unknown; method: string; headers: IncomingHttpHeaders }[]
  server: HTTPServer
  close: () => Promise<void>
}

export interface MockApiTestContext {
  apiUrl: string
  requests: MockApi['requests']
}

// Replace mock-api.js with this once everything migrated

const addRequest = async (requests: MockApi['requests'], request: Request) => {
  const url = new URL(request.url)
  const headers: IncomingHttpHeaders = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  requests.push({
    path: url.pathname,
    body: await request
      .clone()
      .json()
      .catch(() => undefined),
    method: request.method,
    headers,
  })
}

const clearRequests = (requests: unknown[]) => {
  // We cannot create a new array, as the reference of this array is used in tests
  requests.length = 0
}

export const startMockApi = async ({ routes, silent }: MockApiOptions): Promise<MockApi> => {
  const requests: MockApi['requests'] = []
  const server = new HTTPServer(async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    console.log('-> API req', req.url)
    const path = url.pathname.replace('/api/v1/', '')
    const matchedRoute = routes.find(
      (route) => route.path === path && (!route.method || route.method.toLowerCase() === req.method.toLowerCase()),
    )

    if (!matchedRoute) {
      if (!silent) {
        console.warn(`Route not found: (${req.method.toUpperCase()}) ${url.pathname}`)
      }
      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { response = {}, requestBody, status = 200 } = matchedRoute

    if (requestBody !== undefined) {
      const body = await req.json()
      if (!isDeepStrictEqual(requestBody, body)) {
        return new Response(JSON.stringify({ message: `Request body doesn't match` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    addRequest(requests, req)

    if (typeof response === 'function') {
      const customResponse = await response(req, new Response())
      return customResponse || new Response(null, { status: 204 })
    }

    let responseBody = response
    if (status === 404 && typeof response === 'object' && !Array.isArray(response)) {
      responseBody = { ...response, message: 'Not found' }
    }

    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  const address = await server.start()

  console.log('-> API address', address)

  return {
    server,
    apiUrl: `${address.replace('localhost', '127.0.0.1')}/api/v1`,
    requests,
    clearRequests: clearRequests.bind(null, requests),
    async close() {
      await server.stop()
    },
  }
}

type MockAPIContext = {
  apiUrl: string
  requests: { path: string; body: unknown; method: string; headers: IncomingHttpHeaders }[]
}

export const withMockApi = async (
  routes: Route[],
  factory: (context: MockAPIContext) => void | Promise<void>,
  silent = false,
) => {
  let mockApi: Awaited<ReturnType<typeof startMockApi>> | undefined
  try {
    mockApi = await startMockApi({ routes, silent })
    await factory({ apiUrl: mockApi.apiUrl, requests: mockApi.requests })
  } finally {
    await mockApi?.server.stop()
  }
}
