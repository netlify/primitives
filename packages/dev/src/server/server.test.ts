import { describe, expect, test } from 'vitest'

import { Server } from './server.js'
import { Middleware } from '../lib/middleware.js'

describe('Node.js HTTP server', () => {
  test('Runs middleware', async () => {
    const withTeapot: Middleware = async (request, context, next) => {
      const url = new URL(request.url)

      if (url.pathname !== "/teapot") {
        return next(request, context)
      }

      return new Response("I'm a teapot", { status: 418 })
    }
    const withYeller: Middleware = async (request, context, next) => {
      const url = new URL(request.url)

      if (url.searchParams.has("quiet")) {
        return next(request, context)
      }

      const response = await next(request, context)

      if (!response) {
        throw new Error("Expected response")
      }

      const text = await response.text()
      
      return new Response(text.toUpperCase(), response)
    }
    const with404: Middleware = async () => {
      return new Response("Oops, nothing here", { status: 404 })
    }
    const server = new Server()
      .use(withTeapot)
      .use(withYeller)
      .use(with404)

    const address = await server.start()
    
    const res1 = await fetch(address)
    expect(res1.status).toBe(404)
    expect(await res1.text()).toBe("OOPS, NOTHING HERE")

    const res2 = await fetch(`${address}?quiet=1`)
    expect(res2.status).toBe(404)
    expect(await res2.text()).toBe("Oops, nothing here")

    const res3 = await fetch(`${address}/teapot`)
    expect(res3.status).toBe(418)
    expect(await res3.text()).toBe("I'm a teapot")    
  })
})
