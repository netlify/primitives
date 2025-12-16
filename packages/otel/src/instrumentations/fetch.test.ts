import { afterAll, beforeAll, beforeEach, describe, expect, it, test } from 'vitest'
import { FetchInstrumentation } from './fetch.ts'
import { ReadableSpan, SimpleSpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-node'
import { createTracerProvider } from '../bootstrap/main.ts'
import { HTTPServer } from '@netlify/dev-utils'

describe('header exclusion', () => {
  test('skips configured headers', () => {
    const instrumentation = new FetchInstrumentation({
      skipHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
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
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
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
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('secret')
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
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('secret')
    expect(attributes['http.request.header.a']).not.toBe('a')
    expect(attributes['http.request.header.b']).not.toBe('b')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBeTypeOf('string')
    expect(attributes['http.request.header.b']).toBeTypeOf('string')
  })
})

describe('fetch instrumentation (integration)', () => {
  let serverAddress: string
  let server: HTTPServer

  class DummySpanExporter implements SpanExporter {
    readonly exported: ReadableSpan[][] = []

    export(spans: ReadableSpan[]) {
      this.exported.push(spans)
    }

    shutdown() {
      return Promise.resolve()
    }

    forceFlush(): Promise<void> {
      return Promise.resolve()
    }
  }

  const exporter = new DummySpanExporter()

  beforeAll(async () => {
    server = new HTTPServer(() => Promise.resolve(new Response('OK')))
    serverAddress = await server.start()
  })

  beforeEach(() => {
    createTracerProvider({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'test',
      siteUrl: 'https://example.com',
      siteId: '12345',
      siteName: 'example',
      instrumentations: [new FetchInstrumentation()],
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  it('can GET url', async () => {
    const headers = new Headers({ a: 'a' })
    headers.append('b', 'b')
    headers.set('c', 'c')

    await expect(fetch(serverAddress, { headers }).then((r) => r.text())).resolves.toEqual('OK')

    const resultSpan = exporter.exported[0][0]

    expect(resultSpan.name).toEqual('GET')

    expect(resultSpan.attributes).toEqual(
      expect.objectContaining({
        'http.request.method': 'GET',
        'http.response.header.connection': 'keep-alive',
        'http.response.header.content-type': 'text/plain;charset=UTF-8',
        'http.response.header.keep-alive': 'timeout=5',
        'http.response.header.transfer-encoding': 'chunked',
        'http.response.status_code': 200,
        'url.scheme': 'http',
      }),
    )

    // Request headers are skipped in Node 18
    if (!process.version.startsWith('v18')) {
      expect(resultSpan.attributes).toEqual(
        expect.objectContaining({
          'http.request.header.a': 'a',
          'http.request.header.b': 'b',
          'http.request.header.c': 'c',

          'http.request.header.accept': '*/*',
          'http.request.header.accept-encoding': 'gzip, deflate',
          'http.request.header.accept-language': '*',
          'http.request.header.sec-fetch-mode': 'cors',
          'http.request.header.user-agent': 'node',
        }),
      )
    }
  })
})
