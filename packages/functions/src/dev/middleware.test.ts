import { join } from 'node:path'

import { EventInspector, Fixture, Server } from '@netlify/dev'
import { describe, expect, test } from 'vitest'

import { withFunctions } from './middleware.js'
import { FunctionLoadedEvent, FunctionRemovedEvent } from './events.js'

describe('Functions with the v2 API syntax', () => {
  test('Invokes a function and watches for changes', async () => {
    const fixture = new Fixture().withFile(
      'netlify/functions/hello.mjs',
      `export default async () => new Response("Hello world")`,
    )

    const directory = await fixture.create()
    const events = new EventInspector()
    const middleware = withFunctions({
      accountId: 'account-123',
      config: {},
      destPath: join(directory, 'functions-serve'),
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const server = new Server().use(middleware).use(() => new Response('Fallback', { status: 418 }))

    server.on(['*'], (event) => events.handleEvent(event))

    const req1 = new Request('https://site.netlify/.netlify/functions/foo')
    const res1 = await server.handleRequest(req1)
    expect(res1?.status).toBe(418)
    expect(await res1?.text()).toBe('Fallback')

    const req2 = new Request('https://site.netlify/.netlify/functions/hello')
    const res2 = await server.handleRequest(req2)
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello world')

    await fixture.writeFile('netlify/functions/hello.mjs', `export default async () => new Response("Goodbye world")`)
    await events.waitFor((event) => event.name === 'FunctionLoadedEvent' && !(event as FunctionLoadedEvent).firstLoad)

    const req3 = new Request('https://site.netlify/.netlify/functions/hello')
    const res3 = await server.handleRequest(req3)
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Goodbye world')

    await fixture.deleteFile('netlify/functions/hello.mjs')
    await events.waitFor((event) => event.name === 'FunctionRemovedEvent')

    const req4 = new Request('https://site.netlify/.netlify/functions/hello')
    const res4 = await server.handleRequest(req4)
    expect(res4?.status).toBe(418)
    expect(await res4?.text()).toBe('Fallback')

    await fixture.destroy()
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
    const middleware = withFunctions({
      accountId: 'account-123',
      config: {},
      destPath: join(directory, 'functions-serve'),
      projectRoot: directory,
      settings: {},
      timeouts: {},
      userFunctionsPath: 'netlify/functions',
    })

    const server = new Server().use(middleware).use(() => new Response('Fallback', { status: 418 }))

    const req = new Request('https://site.netlify/streamer')
    const res = await server.handleRequest(req)
    expect(res!.status).toBe(200)

    const reader = res!.body!.getReader()

    const firstChunk = await reader.read()
    expect(new TextDecoder().decode(firstChunk.value)).toBe('first chunk')
    expect(firstChunk.done).toBeFalsy()

    const secondChunk = await reader.read()
    expect(new TextDecoder().decode(secondChunk.value)).toBe('second chunk')
    expect(secondChunk.done).toBeFalsy()

    const thirdChunk = await reader.read()
    expect(thirdChunk.done).toBeTruthy()
  })
})
