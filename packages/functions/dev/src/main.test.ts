import { join } from 'node:path'

import { Reactive, EventInspector, FileWatcher, Fixture } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { FunctionsHandler } from './main.js'
import { FunctionLoadedEvent } from './events.js'

describe('Functions with the v2 API syntax', () => {
  test('Invokes a function and watches for changes', async () => {
    const fixture = new Fixture().withFile(
      'netlify/functions/hello.mjs',
      `export default async () => new Response("Hello world")`,
    )

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const events = new EventInspector()
    const fileWatcher = new FileWatcher()
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      eventHandler: (event) => {
        events.handleEvent(event)
      },
      destPath,
      fileWatcher,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req1 = new Request('https://site.netlify/.netlify/functions/foo')
    const match1 = await functions.match(req1, destPath)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify/.netlify/functions/hello')
    const match2 = await functions.match(req2, destPath)
    const res2 = await match2!.handle(req2)
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello world')

    await fixture.writeFile('netlify/functions/hello.mjs', `export default async () => new Response("Goodbye world")`)
    await events.waitFor((event) => event.name === 'FunctionLoadedEvent' && !(event as FunctionLoadedEvent).firstLoad)

    const req3 = new Request('https://site.netlify/.netlify/functions/hello')
    const match3 = await functions.match(req3, destPath)
    const res3 = await match3!.handle(req3)
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Goodbye world')

    await fixture.deleteFile('netlify/functions/hello.mjs')
    await events.waitFor((event) => event.name === 'FunctionRemovedEvent')

    const req4 = new Request('https://site.netlify/.netlify/functions/hello')
    const match4 = await functions.match(req4, destPath)
    expect(match4).toBeUndefined()

    await fixture.destroy()
    await fileWatcher.close()
  })

  test('Invokes a function and streams the response', async () => {
    const source = `
      export default async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue('first chunk')
              setTimeout(() => {
                controller.enqueue('second chunk')
                controller.close()
              }, 200)
            },
          }),
          {
            status: 200,
          },
        )

      export const config = { path: '/streamer' }
    `
    const fixture = new Fixture().withFile('netlify/functions/streamer.mjs', source)

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      destPath,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req = new Request('https://site.netlify/streamer')
    const match = await functions.match(req, destPath)
    expect(match).not.toBeUndefined()
    const res = await match!.handle(req)
    expect(res.status).toBe(200)

    const reader = res.body!.getReader()

    const firstChunk = await reader.read()
    expect(new TextDecoder().decode(firstChunk.value)).toBe('first chunk')
    expect(firstChunk.done).toBeFalsy()

    const secondChunk = await reader.read()
    expect(new TextDecoder().decode(secondChunk.value)).toBe('second chunk')
    expect(secondChunk.done).toBeFalsy()

    const thirdChunk = await reader.read()
    expect(thirdChunk.done).toBeTruthy()
  })

  test('Handles bodyless responses', async () => {
    const source = `
      export default async () =>
        new Response(null,
          {
            status: 304,
          },
        )

      export const config = { path: '/bodyless-response' }
    `
    const fixture = new Fixture().withFile('netlify/functions/bodyless-response.mjs', source)

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      destPath,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req = new Request('https://site.netlify/bodyless-response')
    const match = await functions.match(req, destPath)
    expect(match).not.toBeUndefined()
    const res = await match!.handle(req)
    expect(res.status).toBe(304)
  })

  test('Preserves response headers for v2 functions', async () => {
    const source = `
      export default async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 401,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'www-authenticate': 'Bearer realm="repro"',
            'x-repro-header': 'present',
          },
        })

      export const config = { path: '/headers' }
    `
    const fixture = new Fixture().withFile('netlify/functions/headers.mjs', source)

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      destPath,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req = new Request('https://site.netlify/headers')
    const match = await functions.match(req, destPath)
    expect(match).not.toBeUndefined()

    const res = await match!.handle(req)
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('www-authenticate')).toBe('Bearer realm="repro"')
    expect(res.headers.get('x-repro-header')).toBe('present')
    expect(await res.text()).toBe(JSON.stringify({ ok: true }))
  })

  test('Preserves headers for streamed v2 responses', async () => {
    const source = `
      export default async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue('chunk')
              controller.close()
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'text/event-stream',
              'cache-control': 'no-cache',
              'x-repro-header': 'stream',
            },
          },
        )

      export const config = { path: '/stream-headers' }
    `
    const fixture = new Fixture().withFile('netlify/functions/stream-headers.mjs', source)

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      destPath,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req = new Request('https://site.netlify/stream-headers')
    const match = await functions.match(req, destPath)
    expect(match).not.toBeUndefined()

    const res = await match!.handle(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('x-repro-header')).toBe('stream')
    expect(await res.text()).toBe('chunk')
  })

  test('Returns a `preferStatic` property', async () => {
    const fixture = new Fixture().withFile(
      'netlify/functions/hello.mjs',
      `export default async () => new Response("Hello world")

       export const config = {
         path: "/hello"
       }`,
    )

    const directory = await fixture.create()
    const destPath = join(directory, 'functions-serve')
    const events = new EventInspector()
    const fileWatcher = new FileWatcher()
    const functions = new FunctionsHandler({
      accountId: 'account-123',
      config: new Reactive({}),
      eventHandler: (event) => {
        events.handleEvent(event)
      },
      destPath,
      fileWatcher,
      geolocation: {},
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const req1 = new Request('https://site.netlify/hello')
    const match1 = await functions.match(req1, destPath)
    expect(match1?.preferStatic).toBe(false)
    const res1 = await match1!.handle(req1)
    expect(res1?.status).toBe(200)
    expect(await res1?.text()).toBe('Hello world')

    await fixture.writeFile(
      'netlify/functions/hello.mjs',
      `export default async () => new Response("Goodbye world")
      
       export const config = {
         path: "/hello",
         preferStatic: true
       }`,
    )
    await events.waitFor((event) => event.name === 'FunctionLoadedEvent' && !(event as FunctionLoadedEvent).firstLoad)

    const req2 = new Request('https://site.netlify/hello')
    const match2 = await functions.match(req2, destPath)
    expect(match2?.preferStatic).toBe(true)
    const res2 = await match2!.handle(req2)
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Goodbye world')

    await fixture.destroy()
    await fileWatcher.close()
  })
})
