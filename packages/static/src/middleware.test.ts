import { join } from 'node:path'

import { Fixture, Server } from '@netlify/dev'
import { describe, expect, test } from 'vitest'

import { withStatic } from './middleware.js'

describe('`withStatic` middleware', () => {
  test('Returns static files', async () => {
    const fixture = new Fixture()
      .withFile(
        'public/index.html',
        `Hello from the root`,
      )
      .withFile(
        'public/index.htm',
        `I should not see the light of day`,
      )
      .withFile(
        'public/store/index.html',
        `Hello from the store`,
      )      

    const directory = await fixture.create()
    const middleware = withStatic({
      directory: join(directory, "public")
    })

    const server = new Server().use(middleware).use(() => new Response('Fallback', { status: 418 }))

    const req1 = new Request('https://site.netlify/unknown')
    const res1 = await server.handleRequest(req1)
    expect(res1?.status).toBe(418)
    expect(await res1?.text()).toBe('Fallback')
    expect(res1?.headers.get("age")).toBeNull()
    expect(res1?.headers.get("cache-control")).toBeNull()

    const req2 = new Request('https://site.netlify')
    const res2 = await server.handleRequest(req2)
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello from the root')
    expect(res2?.headers.get("age")).toBe("0")
    expect(res2?.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(res2?.headers.get("content-type")).toBe("text/html; charset=utf-8")

    const req3 = new Request('https://site.netlify/')
    const res3 = await server.handleRequest(req3)
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Hello from the root')
    expect(res3?.headers.get("age")).toBe("0")
    expect(res3?.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(res3?.headers.get("content-type")).toBe("text/html; charset=utf-8")

    const req4 = new Request('https://site.netlify/store')
    const res4 = await server.handleRequest(req4)
    expect(res4?.status).toBe(200)
    expect(await res4?.text()).toBe('Hello from the store')
    expect(res4?.headers.get("age")).toBe("0")
    expect(res4?.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(res4?.headers.get("content-type")).toBe("text/html; charset=utf-8")

    const req5 = new Request('https://site.netlify/store/index.html')
    const res5 = await server.handleRequest(req5)
    expect(res5?.status).toBe(200)
    expect(await res5?.text()).toBe('Hello from the store')
    expect(res5?.headers.get("age")).toBe("0")
    expect(res5?.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(res5?.headers.get("content-type")).toBe("text/html; charset=utf-8")

    await fixture.destroy()
  })
})