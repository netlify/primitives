import path from 'node:path'

import { describe, expect, test } from 'vitest'
import { Fixture } from '@netlify/dev-utils'

import { HeadersHandler } from './main.js'

describe('constructor', () => {
  test('de-duplicates `headersFiles` when project and publish directories resolve to the same path', async () => {
    const fixture = new Fixture().withHeadersFile({
      headers: [{ path: '/test-*', headers: ['foo: bar'] }],
    })
    const projectDir = await fixture.create()

    const handler = new HeadersHandler({
      projectDir,
      publishDir: '.', // resolves to the same path as `projectDir`
      configHeaders: [{ for: '/test-*', values: { 'X-Config-Header': 'config-value' } }],
    })

    expect(handler.headersFiles).toEqual([path.resolve(projectDir, '_headers')])

    await fixture.destroy()
  })
})

describe('handle', () => {
  test('sets response headers matching rules in provided `configHeaders`', async () => {
    const fixture = new Fixture()
    const projectDir = await fixture.create()

    const handler = new HeadersHandler({
      projectDir,
      configHeaders: [{ for: '/test-*', values: { 'X-Config-Header': 'config-value' } }],
    })
    const request = new Request('http://example.com/test-path')
    const response = new Response(null, {
      headers: {
        'Existing-Header': 'existing-value',
      },
    })
    const result = await handler.handle(request, response)

    expect(result.headers.get('X-Config-Header')).toBe('config-value')
    expect(result.headers.get('Existing-Header')).toBe('existing-value')

    await fixture.destroy()
  })

  test('sets response headers matching rules from `_headers` file in project dir', async () => {
    const fixture = new Fixture().withHeadersFile({
      headers: [{ path: '/test-*', headers: ['X-Project-Dir-Header: project-dir-value'] }],
    })
    const projectDir = await fixture.create()
    const handler = new HeadersHandler({
      projectDir,
      configHeaders: undefined,
    })

    const request = new Request('http://example.com/test-path')
    const response = new Response(null, {
      headers: {
        'Existing-Header': 'existing-value',
      },
    })
    const result = await handler.handle(request, response)

    expect(result.headers.get('X-Project-Dir-Header')).toBe('project-dir-value')
    expect(result.headers.get('Existing-Header')).toBe('existing-value')

    await fixture.destroy()
  })

  test('sets response headers matching rules from `_headers` file in publish dir', async () => {
    const fixture = new Fixture().withHeadersFile({
      pathPrefix: '/my-dist',
      headers: [{ path: '/test-*', headers: ['X-Publish-Dir-Header: publish-dir-value'] }],
    })
    const projectDir = await fixture.create()

    const handler = new HeadersHandler({
      projectDir,
      publishDir: 'my-dist',
      configHeaders: undefined,
    })
    const request = new Request('http://example.com/test-path')
    const response = new Response(null, {
      headers: {
        'Existing-Header': 'existing-value',
      },
    })
    const result = await handler.handle(request, response)

    expect(result.headers.get('X-Publish-Dir-Header')).toBe('publish-dir-value')
    expect(result.headers.get('Existing-Header')).toBe('existing-value')

    await fixture.destroy()
  })

  test('sets response headers matching rules in multiple sources', async () => {
    const fixture = new Fixture()
      .withHeadersFile({
        headers: [{ path: '/test-*', headers: ['X-Project-Dir-Header: project-dir-value'] }],
      })
      .withHeadersFile({
        pathPrefix: '/my-dist',
        headers: [{ path: '/test-p*', headers: ['X-Publish-Dir-Header: publish-dir-value'] }],
      })
    const projectDir = await fixture.create()
    const handler = new HeadersHandler({
      projectDir,
      publishDir: 'my-dist',
      configHeaders: [{ for: '/test-pa*', values: { 'X-Config-Header': 'config-value' } }],
    })

    const request = new Request('http://example.com/test-path')
    const response = new Response(null, {
      headers: {
        'Existing-Header': 'existing-value',
      },
    })
    const result = await handler.handle(request, response)

    expect(result.headers.get('X-Project-Dir-Header')).toBe('project-dir-value')
    expect(result.headers.get('X-Publish-Dir-Header')).toBe('publish-dir-value')
    expect(result.headers.get('X-Config-Header')).toBe('config-value')
    expect(result.headers.get('Existing-Header')).toBe('existing-value')

    await fixture.destroy()
  })

  test('leaves response intact when no header rules match', async () => {
    const fixture = new Fixture().withHeadersFile({
      headers: [{ path: '/no-match', headers: ['X-Project-Dir-Header: no-match-value'] }],
    })
    const projectDir = await fixture.create()
    const handler = new HeadersHandler({
      projectDir,
      configHeaders: [{ for: '/no-match', values: { 'X-Config-Header': 'no-match-value' } }],
    })

    const request = new Request('http://example.com/test-path')
    const response = new Response(null, {
      headers: {
        'Existing-Header': 'existing-value',
      },
    })
    const originalHeaders = new Headers(response.headers)
    const result = await handler.handle(request, response)

    expect(result.headers).toEqual(originalHeaders)

    await fixture.destroy()
  })
})
