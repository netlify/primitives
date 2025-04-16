import { describe, expect, test } from 'vitest'

import { HTTPServer } from './http_server.js'

describe('HTTP server', () => {
  test('Serves requests', async () => {
    const server = new HTTPServer(async (req: Request) => {
      const url = new URL(req.url)

      return Response.json({ path: url.pathname })
    })

    const address = await server.start()

    const res1 = await fetch(`${address}/foo`)
    expect(res1.status).toBe(200)
    expect(await res1.json()).toStrictEqual({ path: '/foo' })

    const res2 = await fetch(`${address}/bar/baz`)
    expect(res2.status).toBe(200)
    expect(await res2.json()).toStrictEqual({ path: '/bar/baz' })

    await server.stop()
  })
})
