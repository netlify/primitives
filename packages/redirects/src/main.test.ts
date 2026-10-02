import { join } from 'node:path'

import { Fixture, MockFetch } from '@netlify/test-utils'
import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { Redirect } from './lib/redirect.js'
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
    expect(res).toBeUndefined()

    await fixture.destroy()
  })
})

describe('Conditions and signing', () => {
  const jwtSecret = 'test-secret'
  const jwtRoleClaim = 'app_metadata.authorization.roles'
  const signingVar = 'TEST_REDIRECT_SIGNING_SECRET'
  const fixtures: Fixture[] = []

  const createHandler = async (
    configRedirects: Redirect[],
    options: Partial<ConstructorParameters<typeof RedirectsHandler>[0]> = {},
  ) => {
    const fixture = new Fixture()
    fixtures.push(fixture)
    const directory = await fixture.create()

    return new RedirectsHandler({
      configRedirects,
      configPath: join(directory, 'netlify.toml'),
      jwtRoleClaim,
      jwtSecret,
      projectDir: directory,
      ...options,
    })
  }

  const roleToken = (roles: string[]) =>
    jwt.sign({ app_metadata: { authorization: { roles } } }, jwtSecret, { expiresIn: '1h' })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await Promise.all(fixtures.splice(0).map((fixture) => fixture.destroy()))
  })

  test('Role rule without a JWT is handled as not found', async () => {
    const redirects = await createHandler(
      [{ from: '/admin/*', to: '/admin/:splat', status: 200, conditions: { Role: ['admin'] } }],
      {
        notFoundHandler: async () => new Response('Custom not found', { status: 404 }),
      },
    )

    const req = new Request('https://site.netlify/admin/dashboard')
    const match = await redirects.match(req)
    expect(match).not.toBeUndefined()
    expect(match!.force).toBe(true)
    expect(match!.statusCode).toBe(404)

    const res = await redirects.handle(req, match!, async () => undefined)
    expect(res?.status).toBe(404)
    expect(await res?.text()).toBe('Custom not found')
  })

  test('Role rule with a JWT for the role matches', async () => {
    const redirects = await createHandler([
      { from: '/admin/*', to: '/admin/:splat', status: 200, conditions: { Role: ['admin'] } },
    ])

    const req = new Request('https://site.netlify/admin/dashboard', {
      headers: { cookie: `nf_jwt=${roleToken(['admin'])}` },
    })
    const match = await redirects.match(req)
    expect(match).not.toBeUndefined()
    expect(match!.statusCode).toBe(200)
    expect(match!.target).toStrictEqual(new URL('https://site.netlify/admin/dashboard'))
  })

  test('Country condition matches the configured geo country', async () => {
    const configRedirects: Redirect[] = [{ from: '/', to: '/de/', status: 302, conditions: { Country: ['de'] } }]
    const german = await createHandler(configRedirects, { geoCountry: 'de' })
    const american = await createHandler(configRedirects, { geoCountry: 'us' })

    const germanMatch = await german.match(new Request('https://site.netlify/'))
    expect(germanMatch?.redirect).toBe(true)
    expect(germanMatch?.target).toStrictEqual(new URL('https://site.netlify/de/'))

    expect(await american.match(new Request('https://site.netlify/'))).toBeUndefined()
  })

  test('Language condition matches the Accept-Language header', async () => {
    const redirects = await createHandler([{ from: '/', to: '/fr/', status: 302, conditions: { Language: ['fr'] } }])

    const french = await redirects.match(
      new Request('https://site.netlify/', { headers: { 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8' } }),
    )
    expect(french?.target).toStrictEqual(new URL('https://site.netlify/fr/'))

    expect(
      await redirects.match(new Request('https://site.netlify/', { headers: { 'accept-language': 'en-US' } })),
    ).toBeUndefined()
  })

  test('Signed rule signs the request when its secret is set', async () => {
    vi.stubEnv(signingVar, 'signing-secret-value')
    const redirects = await createHandler([
      { from: '/api/*', to: 'https://api.example.com/:splat', status: 200, signed: signingVar },
    ])

    const match = await redirects.match(new Request('https://site.netlify/api/users'))
    expect(match?.error).toBeUndefined()
    expect(match?.external).toBe(true)
    const signature = match?.headers['x-nf-sign']
    expect(typeof signature).toBe('string')
    expect(jwt.verify(signature!, 'signing-secret-value')).toMatchObject({ deploy_context: 'dev' })
  })

  test('Signed rule reports an error when its secret is not set', async () => {
    const redirects = await createHandler([
      { from: '/api/*', to: 'https://api.example.com/:splat', status: 200, signed: signingVar },
    ])

    const match = await redirects.match(new Request('https://site.netlify/api/users'))
    expect(match?.headers['x-nf-sign']).toBeUndefined()
    expect(match?.error?.message).toBe(`Could not sign redirect because environment variable ${signingVar} is not set`)
  })
})
