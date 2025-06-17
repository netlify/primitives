import path from 'node:path'

import { describe, expect, test, beforeAll, afterAll } from 'vitest'

import { Fixture, HTTPServer } from '@netlify/dev-utils'
import { EdgeFunctionsHandler } from './main.js'

describe('`EdgeFunctionsHandler`', () => {
  let serverAddress: string
  let server: HTTPServer

  const geolocation = {
    city: 'San Francisco',
    country: { code: 'US', name: 'United States' },
    subdivision: { code: 'CA', name: 'California' },
    longitude: 0,
    latitude: 0,
    timezone: 'UTC',
  }

  beforeAll(async () => {
    server = new HTTPServer(async () => new Response('From origin'))

    serverAddress = await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('Runs an edge function', async () => {
    const fixture = new Fixture()
      .withFile(
        'netlify.toml',
        `[build]
        publish = "public"
        `,
      )
      .withFile(
        'netlify/edge-functions/echo.mjs',
        `export default async (req, context) => Response.json({
             env: {
               VAR_1: Netlify.env.get("VAR_1"),
               VAR_2: Netlify.env.get("VAR_2")             
             },
             geo: context.geo,
             params: context.params,
             path: context.path,
             server: context.server,
             site: context.site,
             url: context.url
           });
           
           export const config = { path: "/echo" };`,
      )

    const directory = await fixture.create()
    const handler = new EdgeFunctionsHandler({
      configDeclarations: [],
      directories: [path.resolve(directory, 'netlify/edge-functions')],
      env: {
        VAR_1: 'value1',
        VAR_2: 'value2',
      },
      geolocation,
      logger: console,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/echo')
    req.headers.set('x-nf-request-id', 'req-id')

    const match = await handler.match(req)
    expect(match).toBeTruthy()

    const res = await match?.handle(req, serverAddress)

    expect(await res?.json()).toStrictEqual({
      env: { VAR_1: 'value1', VAR_2: 'value2' },
      geo: {
        city: 'San Francisco',
        country: { code: 'US', name: 'United States' },
        subdivision: { code: 'CA', name: 'California' },
        longitude: 0,
        latitude: 0,
        timezone: 'UTC',
      },
      params: {},
      server: { region: 'dev' },
      site: { id: '123', name: 'test', url: serverAddress },
      url: `${serverAddress}/echo`,
    })

    await fixture.destroy()
  })

  test('Runs an edge function with a passthrough call', async () => {
    const fixture = new Fixture()
      .withFile(
        'netlify.toml',
        `[build]
        publish = "public"
        `,
      )
      .withFile(
        'netlify/edge-functions/echo.mjs',
        `export default async (req, context) => {
          const res = await context.next();
          const text = await res.text();

          return new Response(text.toUpperCase(), res);
        }
           
        export const config = { path: "/yell" };`,
      )

    const directory = await fixture.create()
    const handler = new EdgeFunctionsHandler({
      configDeclarations: [],
      directories: [path.resolve(directory, 'netlify/edge-functions')],
      env: {
        VAR_1: 'value1',
        VAR_2: 'value2',
      },
      geolocation,
      logger: console,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/yell')
    req.headers.set('x-nf-request-id', 'req-id')

    const match = await handler.match(req)
    expect(match).toBeTruthy()

    const res = await match?.handle(req, serverAddress)

    expect(await res?.text()).toStrictEqual('FROM ORIGIN')

    await fixture.destroy()
  })

  test('Runs an edge function with an npm package', async () => {
    const fixture = new Fixture()
      .withFile(
        'netlify.toml',
        `[build]
        publish = "public"
        `,
      )
      .withFile(
        'netlify/edge-functions/slugify.mjs',
        `import slugify from 'slugify'

        export default async (req) => {
          const text = new URL(req.url).searchParams.get('text') || ''
          const slug = slugify(text, { lower: true })
          
          return Response.json({ slug })
        }
           
        export const config = { path: "/slugify" };`,
      )
      .withPackages({
        slugify: '^1.6.0',
      })

    const directory = await fixture.create()
    const handler = new EdgeFunctionsHandler({
      configDeclarations: [],
      directories: [path.resolve(directory, 'netlify/edge-functions')],
      env: {
        VAR_1: 'value1',
        VAR_2: 'value2',
      },
      geolocation,
      logger: console,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/slugify?text=Hello World')
    req.headers.set('x-nf-request-id', 'req-id')

    const match = await handler.match(req)
    expect(match).toBeTruthy()

    const res = await match?.handle(req, serverAddress)

    expect(await res?.json()).toStrictEqual({
      slug: 'hello-world',
    })

    await fixture.destroy()
  })

  test('Throws an error when the edge function has unparseable code', async () => {
    const fixture = new Fixture()
      .withFile(
        'netlify.toml',
        `[build]
        publish = "public"
        `,
      )
      .withFile(
        'netlify/edge-functions/unparseable.mjs',
        `export default async () => new Response("Hello");
           
        // This is the problem!
        export const config = { path: "/unparseable };`,
      )

    const directory = await fixture.create()
    const handler = new EdgeFunctionsHandler({
      configDeclarations: [],
      directories: [path.resolve(directory, 'netlify/edge-functions')],
      env: {},
      geolocation,
      logger: console,
      requestTimeout: 1_000,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/unparseable')
    req.headers.set('x-nf-request-id', 'req-id')

    const match = await handler.match(req)
    expect(match).toBeTruthy()

    const res = await match?.handle(req, serverAddress)

    expect(res?.status).toBe(500)
    expect(await res?.text()).toContain('Failed to parse edge function `unparseable`')

    await fixture.destroy()
  })

  test('Aborts an invocation if the function takes too long to produce a response', async () => {
    const fixture = new Fixture()
      .withFile(
        'netlify.toml',
        `[build]
        publish = "public"
        `,
      )
      .withFile(
        'netlify/edge-functions/slow.mjs',
        `export default async () => {
          await new Promise(resolve => setTimeout(resolve, 2_000));

          return new Response("Done");
        };
           
        export const config = { path: "/slow" };`,
      )

    const directory = await fixture.create()
    const handler = new EdgeFunctionsHandler({
      configDeclarations: [],
      directories: [path.resolve(directory, 'netlify/edge-functions')],
      env: {},
      geolocation,
      logger: console,
      requestTimeout: 1_000,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/slow')
    req.headers.set('x-nf-request-id', 'req-id')

    const match = await handler.match(req)
    expect(match).toBeTruthy()

    const res = await match?.handle(req, serverAddress)

    expect(res?.status).toBe(500)
    expect(await res?.text()).toContain('An edge function took too long to produce a response')

    await fixture.destroy()
  })
})
