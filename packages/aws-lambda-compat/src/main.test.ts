import { describe, expect, test } from 'vitest'

import type { Context } from '@netlify/types'

import type { HandlerEvent, HandlerContext } from './main.js'

import { buildLambdaContext } from './lib/request_to_event.js'
import { withLambda } from './main.js'

const createNetlifyContext = (overrides: Partial<Context> = {}): Context =>
  ({
    requestId: 'test-request-id',
    account: { id: 'test-account' },
    cookies: {},
    deploy: { context: 'dev', id: 'deploy-id', published: false },
    geo: {},
    ip: '127.0.0.1',
    json: () => new Response(),
    log: () => {},
    next: () => Promise.resolve(new Response()),
    params: {},
    rewrite: () => Promise.resolve(new Response()),
    server: {},
    site: {},
    url: new URL('http://localhost'),
    waitUntil: () => {},
    ...overrides,
  }) as Context

describe('withLambda', () => {
  test('basic GET request', async () => {
    const handler = withLambda((event: HandlerEvent) => ({
      statusCode: 200,
      body: JSON.stringify({ method: event.httpMethod, path: event.path }),
    }))

    const request = new Request('https://example.com/hello')
    const response = await handler(request, createNetlifyContext())

    expect(response.status).toBe(200)
    const body = (await response.json()) as { method: string; path: string }
    expect(body.method).toBe('GET')
    expect(body.path).toBe('/hello')
  })

  test('GET request populates rawUrl and headers', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/test?foo=bar', {
      headers: { 'x-custom': 'value' },
    })
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.rawUrl).toBe('https://example.com/test?foo=bar')
    expect(capturedEvent?.headers['x-custom']).toBe('value')
  })

  test('POST with text body', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    })
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.body).toBe('{"name":"test"}')
    expect(capturedEvent?.isBase64Encoded).toBe(false)
    expect(capturedEvent?.httpMethod).toBe('POST')
  })

  test('POST with binary body', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const request = new Request('https://example.com/upload', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: binaryData,
    })
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.isBase64Encoded).toBe(true)
    expect(capturedEvent?.body).toBe(btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47)))
  })

  test('query parameters', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/search?color=red&color=blue&size=large')
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.queryStringParameters).toEqual({
      color: 'blue',
      size: 'large',
    })
    expect(capturedEvent?.multiValueQueryStringParameters).toEqual({
      color: ['red', 'blue'],
      size: ['large'],
    })
    expect(capturedEvent?.rawQuery).toBe('color=red&color=blue&size=large')
  })

  test('response headers from headers and multiValueHeaders', async () => {
    const handler = withLambda(() => ({
      statusCode: 200,
      headers: { 'x-single': 'one' },
      multiValueHeaders: { 'set-cookie': ['a=1', 'b=2'] },
      body: 'ok',
    }))

    const request = new Request('https://example.com/')
    const response = await handler(request, createNetlifyContext())

    expect(response.headers.get('x-single')).toBe('one')
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
  })

  test('base64 encoded response body', async () => {
    const originalBytes = new Uint8Array([72, 101, 108, 108, 111])
    const base64Body = btoa(String.fromCharCode(...originalBytes))

    const handler = withLambda(() => ({
      statusCode: 200,
      body: base64Body,
      isBase64Encoded: true,
    }))

    const request = new Request('https://example.com/')
    const response = await handler(request, createNetlifyContext())

    const buffer = await response.arrayBuffer()
    const resultBytes = new Uint8Array(buffer)
    expect(resultBytes).toEqual(originalBytes)
  })

  test('context mapping', async () => {
    let capturedContext: HandlerContext | undefined

    const handler = withLambda((_event: HandlerEvent, context: HandlerContext) => {
      capturedContext = context

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/')
    await handler(request, createNetlifyContext({ requestId: 'my-request-123' }))

    expect(capturedContext).toBeDefined()
    expect(capturedContext?.awsRequestId).toBe('my-request-123')
    expect(capturedContext?.callbackWaitsForEmptyEventLoop).toBe(true)
    expect(capturedContext?.functionName).toBe('')
    expect(capturedContext?.getRemainingTimeInMillis()).toBe(0)
  })

  test('context deprecated methods throw', () => {
    const ctx = buildLambdaContext({ requestId: 'test' })

    /* eslint-disable @typescript-eslint/no-deprecated */
    expect(() => {
      ctx.done()
    }).toThrow('not supported')
    expect(() => {
      ctx.fail('err')
    }).toThrow('not supported')
    expect(() => {
      ctx.succeed('ok')
    }).toThrow('not supported')
    /* eslint-enable @typescript-eslint/no-deprecated */
  })

  test('null body for GET requests', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/')
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.body).toBeNull()
  })

  test('response with no body', async () => {
    const handler = withLambda(() => ({
      statusCode: 204,
    }))

    const request = new Request('https://example.com/')
    const response = await handler(request, createNetlifyContext())

    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  test('empty query string results in null parameters', async () => {
    let capturedEvent: HandlerEvent | undefined

    const handler = withLambda((event: HandlerEvent) => {
      capturedEvent = event

      return { statusCode: 200, body: '' }
    })

    const request = new Request('https://example.com/path')
    await handler(request, createNetlifyContext())

    expect(capturedEvent).toBeDefined()
    expect(capturedEvent?.queryStringParameters).toBeNull()
    expect(capturedEvent?.multiValueQueryStringParameters).toBeNull()
    expect(capturedEvent?.rawQuery).toBe('')
  })
})
