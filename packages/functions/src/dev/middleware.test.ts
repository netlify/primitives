import { join } from 'node:path'

import { EventInspector, Fixture } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { FunctionsRegistry } from './registry.js'
import { withFunctions } from './middleware.js'
import { FunctionReloadedEvent } from './events.js'

describe('`withFunctions` middleware', () => {
  test('Invokes a function and watches for changes', async () => {
    const fixture = new Fixture().withFile(
      'netlify/functions/hello.mjs',
      `export default async () => new Response("Hello world")`,
    )

    const directory = await fixture.create()
    const events = new EventInspector()
    const functionsRegistry = new FunctionsRegistry({
      config: {},
      destPath: join(directory, 'functions-serve'),
      eventHandler: (event) => Promise.resolve(events.handleEvent(event)),
      projectRoot: directory,
      settings: {},
      timeouts: {},
    })
    const middleware = withFunctions({
      accountId: 'account-123',
      config: {},
      functionsRegistry,
      siteUrl: 'https://site.netlify',
      state: {},
    })

    await functionsRegistry.scan(['netlify/functions'])

    const next = async () => new Response('Fallback', { status: 418 })

    const req1 = new Request('https://site.netlify/.netlify/functions/foo')
    const res1 = await middleware(req1, {}, next)
    expect(res1?.status).toBe(418)
    expect(await res1?.text()).toBe('Fallback')

    const req2 = new Request('https://site.netlify/.netlify/functions/hello')
    const res2 = await middleware(req2, {}, next)
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello world')

    await fixture.writeFile('netlify/functions/hello.mjs', `export default async () => new Response("Goodbye world")`)
    await events.waitFor((event) => event instanceof FunctionReloadedEvent)

    const req3 = new Request('https://site.netlify/.netlify/functions/hello')
    const res3 = await middleware(req3, {}, next)
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Goodbye world')

    await fixture.destroy()
  })
})
