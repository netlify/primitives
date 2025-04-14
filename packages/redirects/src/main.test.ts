import { join } from 'node:path'

import { Fixture, MockFetch } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { RedirectsHandler } from './main.js'

describe('Matching rules', () => {
  test('Same-site rewrite', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: '/to',
          status: 200,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req1 = new Request('https://site.netlify/foo')
    const match1 = await redirects.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify/from')
    const match2 = await redirects.match(req2)
    expect(match2).not.toBeUndefined()
    expect(match2!.external).toBe(false)
    expect(match2!.redirect).toBe(false)
    expect(match2!.target).toStrictEqual(new URL('https://site.netlify/to'))
    expect(match2!.targetRelative).toBe('/to')

    await fixture.destroy()
  })

  test('Same-site redirect', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: '/to',
          status: 301,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req1 = new Request('https://site.netlify/foo')
    const match1 = await redirects.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify/from')
    const match2 = await redirects.match(req2)
    expect(match2).not.toBeUndefined()
    expect(match2!.external).toBe(false)
    expect(match2!.redirect).toBe(true)
    expect(match2!.target).toStrictEqual(new URL('https://site.netlify/to'))
    expect(match2!.targetRelative).toBe('/to')

    await fixture.destroy()
  })

  test('External rewrite', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: 'https://example.com/to',
          status: 200,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req1 = new Request('https://site.netlify/foo')
    const match1 = await redirects.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify/from')
    const match2 = await redirects.match(req2)
    expect(match2).not.toBeUndefined()
    expect(match2!.external).toBe(true)
    expect(match2!.redirect).toBe(false)
    expect(match2!.target).toStrictEqual(new URL('https://example.com/to'))
    expect(match2!.targetRelative).toBe('https://example.com/to')

    await fixture.destroy()
  })

  test('External redirect', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: 'https://example.com/to',
          status: 302,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req1 = new Request('https://site.netlify/foo')
    const match1 = await redirects.match(req1)
    expect(match1).toBeUndefined()

    const req2 = new Request('https://site.netlify/from')
    const match2 = await redirects.match(req2)
    expect(match2).not.toBeUndefined()
    expect(match2!.external).toBe(true)
    expect(match2!.redirect).toBe(true)
    expect(match2!.target).toStrictEqual(new URL('https://example.com/to'))
    expect(match2!.targetRelative).toBe('https://example.com/to')

    await fixture.destroy()
  })
})

describe('Handling rules', () => {
  test('Non-forced rewrite to static file', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: '/to',
          status: 200,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req = new Request('https://site.netlify/from')
    const match = await redirects.match(req)
    expect(match).not.toBeUndefined()

    const res = await redirects.handle(req, match!, async (lookup: Request) => {
      expect(lookup.url).toBe('https://site.netlify/from')

      return async () => new Response('Static file')
    })
    expect(await res?.text()).toBe('Static file')

    await fixture.destroy()
  })

  test('External rewrite', async () => {
    const mockFetch = new MockFetch().get({
      response: new Response('Hello from example.com'),
      url: 'https://example.com/',
    })

    globalThis.fetch = mockFetch.fetch

    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: 'https://example.com',
          status: 200,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req = new Request('https://site.netlify/from')
    const match = await redirects.match(req)
    expect(match).not.toBeUndefined()

    const res = await redirects.handle(req, match!, async () => undefined)
    expect(res?.status).toBe(200)
    expect(await res?.text()).toBe('Hello from example.com')

    await fixture.destroy()
    mockFetch.restore()

    expect(mockFetch.fulfilled).toBeTruthy()
  })

  test('Internal rewrite', async () => {
    const fixture = new Fixture()
    const directory = await fixture.create()
    const redirects = new RedirectsHandler({
      configRedirects: [
        {
          from: '/from',
          to: '/to',
          status: 200,
        },
      ],
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir: directory,
    })

    const req = new Request('https://site.netlify/from')
    const match = await redirects.match(req)
    expect(match).not.toBeUndefined()

    const res = await redirects.handle(req, match!, async () => undefined)
    expect(res).toBe(null)

    await fixture.destroy()
  })
})
