import path from 'node:path'

import { expect, it, vi } from 'vitest'
import { Fixture, createMockLogger } from '@netlify/dev-utils'

import { parseHeaders } from './parseHeaders.js'

const headers = [
  { path: '/', headers: ['X-Frame-Options: SAMEORIGIN'] },
  { path: '/*', headers: ['X-Frame-Thing: SAMEORIGIN'] },
  {
    path: '/static-path/*',
    headers: [
      'X-Frame-Options: DENY',
      'X-XSS-Protection: 1; mode=block',
      'cache-control: max-age=0',
      'cache-control: no-cache',
      'cache-control: no-store',
      'cache-control: must-revalidate',
    ],
  },
  { path: '/:placeholder/index.html', headers: ['X-Frame-Options: SAMEORIGIN'] },
  {
    path: '/directory/*/test.html',
    headers: ['X-Frame-Options: test'],
  },
  {
    path: '/with-colon',
    headers: ['Custom-header: http://www.example.com'],
  },
]

it('allows valid syntax', async () => {
  const fixture = new Fixture().withHeadersFile({ headers })
  const directory = await fixture.create()

  const headersFile = path.resolve(directory, '_headers')
  const logger = { ...createMockLogger(), error: vi.fn() }
  await expect(parseHeaders({ configHeaders: [], headersFiles: [headersFile], logger })).resolves.not.toThrowError()

  expect(logger.error).not.toHaveBeenCalled()

  await fixture.destroy()
})

it('logs an error without throwing on invalid syntax', async () => {
  const fixture = new Fixture().withFile(
    '_invalid_headers',
    `
/
# This is valid
X-Frame-Options: SAMEORIGIN
# This is not valid
X-Frame-Thing:
`,
  )
  const directory = await fixture.create()

  const invalidHeadersFile = path.resolve(directory, '_invalid_headers')
  const logger = { ...createMockLogger(), error: vi.fn() }
  await expect(
    parseHeaders({ configHeaders: [], headersFiles: [invalidHeadersFile], logger }),
  ).resolves.not.toThrowError()

  expect(logger.error).toHaveBeenCalledOnce()
  expect(logger.error).toHaveBeenCalledWith(`Headers syntax errors:
Could not parse header line 6:
  X-Frame-Thing:
Missing header value`)

  await fixture.destroy()
})

it('parses header rules', async () => {
  const fixture = new Fixture().withHeadersFile({ headers })
  const directory = await fixture.create()

  const headersFile = path.resolve(directory, '_headers')
  const logger = createMockLogger()
  const rules = await parseHeaders({ configHeaders: [], headersFiles: [headersFile], logger })

  const normalizedHeaders = rules.map(({ for: path, values }) => ({ for: path, values }))
  expect(normalizedHeaders).toEqual([
    {
      for: '/',
      values: {
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
    {
      for: '/*',
      values: {
        'X-Frame-Thing': 'SAMEORIGIN',
      },
    },
    {
      for: '/static-path/*',
      values: {
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
      },
    },
    {
      for: '/:placeholder/index.html',
      values: {
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
    {
      for: '/directory/*/test.html',
      values: {
        'X-Frame-Options': 'test',
      },
    },
    {
      for: '/with-colon',
      values: {
        'Custom-header': 'http://www.example.com',
      },
    },
  ])

  await fixture.destroy()
})
