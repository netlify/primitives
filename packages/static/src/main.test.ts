import { join } from 'node:path'

import { Fixture } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { StaticHandler } from './main.js'

describe('`StaticHandler`', () => {
  test('Returns static files', async () => {
    const fixture = new Fixture()
      .withFile('public/index.html', `Hello from the root`)
      .withFile('public/index.htm', `I should not see the light of day`)
      .withFile('public/store/index.html', `Hello from the store`)

    const directory = await fixture.create()
    const handler = new StaticHandler({
      directory: join(directory, 'public'),
    })

    const req1 = new Request('https://site.netlify/unknown')
    const match1 = await handler.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify')
    const match2 = await handler.match(req2)
    expect(match2).not.toBeUndefined()
    const res2 = await match2?.handle()
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello from the root')
    expect(res2?.headers.get('age')).toBe('0')
    expect(res2?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res2?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req3 = new Request('https://site.netlify/')
    const match3 = await handler.match(req3)
    expect(match3).not.toBeUndefined()
    const res3 = await match3?.handle()
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Hello from the root')
    expect(res3?.headers.get('age')).toBe('0')
    expect(res3?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res3?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req4 = new Request('https://site.netlify/store')
    const match4 = await handler.match(req4)
    expect(match4).not.toBeUndefined()
    const res4 = await match4?.handle()
    expect(res4?.status).toBe(200)
    expect(await res4?.text()).toBe('Hello from the store')
    expect(res4?.headers.get('age')).toBe('0')
    expect(res4?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res4?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req5 = new Request('https://site.netlify/store/index.html')
    const match5 = await handler.match(req5)
    expect(match5).not.toBeUndefined()
    const res5 = await match5?.handle()
    expect(res5?.status).toBe(200)
    expect(await res5?.text()).toBe('Hello from the store')
    expect(res5?.headers.get('age')).toBe('0')
    expect(res5?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res5?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    await fixture.destroy()
  })

  test('Supports multiple directories', async () => {
    const fixture = new Fixture()
      .withFile('public/index.html', `Hello from the root`)
      .withFile('public/index.htm', `I should not see the light of day`)
      .withFile('public/store/index.html', `Hello from the store`)
      .withFile('other/hello.html', `Hello from the other directory`)

    const directory = await fixture.create()
    const handler = new StaticHandler({
      directory: [join(directory, 'public'), join(directory, 'other')],
    })

    const req1 = new Request('https://site.netlify/unknown')
    const match1 = await handler.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify')
    const match2 = await handler.match(req2)
    expect(match2).not.toBeUndefined()
    const res2 = await match2?.handle()
    expect(res2?.status).toBe(200)
    expect(await res2?.text()).toBe('Hello from the root')
    expect(res2?.headers.get('age')).toBe('0')
    expect(res2?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res2?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req3 = new Request('https://site.netlify/hello')
    const match3 = await handler.match(req3)
    expect(match3).not.toBeUndefined()
    const res3 = await match3?.handle()
    expect(res3?.status).toBe(200)
    expect(await res3?.text()).toBe('Hello from the other directory')
    expect(res3?.headers.get('age')).toBe('0')
    expect(res3?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res3?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req4 = new Request('https://site.netlify/store')
    const match4 = await handler.match(req4)
    expect(match4).not.toBeUndefined()
    const res4 = await match4?.handle()
    expect(res4?.status).toBe(200)
    expect(await res4?.text()).toBe('Hello from the store')
    expect(res4?.headers.get('age')).toBe('0')
    expect(res4?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res4?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const req5 = new Request('https://site.netlify/store/index.html')
    const match5 = await handler.match(req5)
    expect(match5).not.toBeUndefined()
    const res5 = await match5?.handle()
    expect(res5?.status).toBe(200)
    expect(await res5?.text()).toBe('Hello from the store')
    expect(res5?.headers.get('age')).toBe('0')
    expect(res5?.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(res5?.headers.get('content-type')).toBe('text/html; charset=utf-8')

    await fixture.destroy()
  })
})
