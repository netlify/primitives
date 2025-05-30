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
      originServerAddress: serverAddress,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/echo')
    req.headers.set('x-nf-request-id', 'req-id')

    const res = await handler.handle(req)

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
      site: { name: 'test' },
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
      originServerAddress: serverAddress,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/yell')
    req.headers.set('x-nf-request-id', 'req-id')

    const res = await handler.handle(req)

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
      originServerAddress: serverAddress,
      siteID: '123',
      siteName: 'test',
    })

    const req = new Request('https://site.netlify/slugify?text=Hello World')
    req.headers.set('x-nf-request-id', 'req-id')

    const res = await handler.handle(req)

    expect(await res?.json()).toStrictEqual({
      slug: 'hello-world',
    })

    // await fixture.destroy()
  })
})
