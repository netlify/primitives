import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from 'vitest'
import { createTracerProvider } from '../bootstrap/main.ts'
import { shutdownTracers } from '../main.ts'
import { FetchInstrumentation } from './fetch.ts'

describe('header exclusion', () => {
  test('skips configured headers', () => {
    const instrumentation = new FetchInstrumentation({
      skipHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      new Headers({
        a: 'a',
        b: 'b',
        authorization: 'secret',
      }),
    )
    expect(attributes).toEqual({
      'http.request.header.a': 'a',
      'http.request.header.b': 'b',
    })
  })

  test('it skips all headers if so configured', () => {
    const everything = new FetchInstrumentation({
      skipHeaders: true,
    })
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const empty = everything['prepareHeaders'](
      'request',
      new Headers({
        a: 'a',
        b: 'b',
        authorization: 'secret',
      }),
    )
    expect(empty).toEqual({})
  })

  test('redacts configured headers', () => {
    const instrumentation = new FetchInstrumentation({
      redactHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      new Headers({
        a: 'a',
        b: 'b',
        authorization: 'a secret',
      }),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('a secret')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBe('a')
    expect(attributes['http.request.header.b']).toBe('b')
  })

  test('redacts everything if so requested', () => {
    const instrumentation = new FetchInstrumentation({
      redactHeaders: true,
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      new Headers({
        a: 'a',
        b: 'b',
        authorization: 'a secret',
      }),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('a secret')
    expect(attributes['http.request.header.a']).not.toBe('a')
    expect(attributes['http.request.header.b']).not.toBe('b')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBeTypeOf('string')
    expect(attributes['http.request.header.b']).toBeTypeOf('string')
  })
})

describe('patched fetch', async () => {
  const server = setupServer(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    http.get('http://localhost:3000/ok', () => HttpResponse.json({ message: 'ok' })),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    http.post('http://localhost:3000/ok', () => HttpResponse.json({ message: 'ok' })),
  )

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  beforeEach(async () => {
    await createTracerProvider({
      headers: new Headers({ 'x-nf-enable-tracing': 'true' }),
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'test',
      siteUrl: 'https://example.com',
      siteId: '12345',
      siteName: 'example',
      instrumentations: [new FetchInstrumentation()],
    })
  })

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    server.resetHandlers()
    await shutdownTracers()
  })

  afterAll(() => {
    server.close()
  })

  it('can GET url', async () => {
    await createTracerProvider({
      headers: new Headers({ 'x-nf-enable-tracing': 'true' }),
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'test',
      siteUrl: 'https://example.com',
      siteId: '12345',
      siteName: 'example',
      instrumentations: [new FetchInstrumentation()],
    })

    await expect(fetch('http://localhost:3000/ok').then((r) => r.json())).resolves.toEqual({ message: 'ok' })
  })

  it('can POST url', async () => {
    await expect(
      fetch('http://localhost:3000/ok', {
        method: 'POST',
        body: JSON.stringify({ hello: 'rabbit' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((r) => r.json()),
    ).resolves.toEqual({ message: 'ok' })
  })

  it('can GET request', async () => {
    const req = new Request('http://localhost:3000/ok')
    await expect(fetch(req).then((r) => r.json())).resolves.toEqual({ message: 'ok' })
  })

  it('can POST request', async () => {
    const req = new Request('http://localhost:3000/ok', {
      method: 'POST',
      body: JSON.stringify({ hello: 'rabbit' }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    await expect(fetch(req).then((r) => r.json())).resolves.toEqual({ message: 'ok' })
  })
})
