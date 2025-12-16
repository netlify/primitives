import * as http from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, test } from 'vitest'
import { HttpInstrumentation } from './http.ts'
import { HTTPServer } from '@netlify/dev-utils'
import { SpanExporter, ReadableSpan, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { createTracerProvider } from '../bootstrap/main.ts'

describe('header exclusion', () => {
  test('skips configured headers', () => {
    const instrumentation = new HttpInstrumentation({
      skipHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders']('request', {
      a: 'a',
      b: 'b',
      authorization: 'secret',
    })
    expect(attributes).toEqual({
      'http.request.header.a': 'a',
      'http.request.header.b': 'b',
    })
  })

  test('it skips all headers if so configured', () => {
    const everything = new HttpInstrumentation({
      skipHeaders: true,
    })
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const empty = everything['prepareHeaders']('request', {
      a: 'a',
      b: 'b',
      authorization: 'secret',
    })
    expect(empty).toEqual({})
  })

  test('redacts configured headers', () => {
    const instrumentation = new HttpInstrumentation({
      redactHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders']('request', {
      a: 'a',
      b: 'b',
      authorization: 'secret',
    })
    expect(attributes['http.request.header.authorization']).not.toBe('secret')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBe('a')
    expect(attributes['http.request.header.b']).toBe('b')
  })

  test('redacts everything if so requested', () => {
    const instrumentation = new HttpInstrumentation({
      redactHeaders: true,
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders']('request', {
      a: 'a',
      b: 'b',
      authorization: 'secret',
    })
    expect(attributes['http.request.header.authorization']).not.toBe('secret')
    expect(attributes['http.request.header.a']).not.toBe('a')
    expect(attributes['http.request.header.b']).not.toBe('b')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBeTypeOf('string')
    expect(attributes['http.request.header.b']).toBeTypeOf('string')
  })
})

describe('http instrumentation (integration)', () => {
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
      instrumentations: [new HttpInstrumentation()],
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  it.skipIf(process.version.startsWith('v18'))('can GET url', async () => {
    const request = (options: object): Promise<{ statusCode?: number; body?: string }> =>
      new Promise((resolve, reject) => {
        // Inspired from https://gist.github.com/ktheory/df3440b01d4b9d3197180d5254d7fb65
        const req = http.request(options, (res) => {
          const chunks: string[] = []

          res.on('data', (chunk: string) => chunks.push(chunk))
          res.on('error', reject)
          res.on('end', () => {
            const { statusCode } = res
            const body = chunks.join('')
            resolve({ statusCode, body })
          })
        })

        req.on('error', reject)
        req.end()
      })

    const options = {
      hostname: 'localhost',
      port: serverAddress.split(':')[2],
      headers: {
        a: 'a',
        b: 'b',
        c: 'c',
      },
    }

    await expect(request(options).then((r) => r.body)).resolves.toEqual('OK')

    const resultSpan = exporter.exported[0][0]

    expect(resultSpan.name).toEqual('GET')

    expect(resultSpan.attributes).toEqual(
      expect.objectContaining({
        'http.request.header.a': 'a',
        'http.request.header.b': 'b',
        'http.request.header.c': 'c',
        'http.request.method': 'GET',
        'http.response.header.connection': 'keep-alive',
        'http.response.header.content-type': 'text/plain;charset=UTF-8',
        'http.response.header.keep-alive': 'timeout=5',
        'http.response.header.transfer-encoding': 'chunked',
        'http.response.status_code': 200,
        'server.address': 'localhost',
        'url.full': 'http://localhost/',
        'url.host': 'localhost',
        'url.scheme': 'http',
      }),
    )
  })
})
