import path from 'node:path'

import { expect, it } from 'vitest'
import { Fixture } from '@netlify/dev-utils'

import { parseHeaders } from './parseHeaders.js'
import { headersForPath } from './headersForPath.js'

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
  /**
   * Do not force * to appear at end of path.
   *
   * @see https://github.com/netlify/next-on-netlify/issues/151
   * @see https://github.com/netlify/cli/issues/1148
   */
  {
    path: '/*/_next/static/chunks/*',
    headers: ['cache-control: public', 'cache-control: max-age=31536000', 'cache-control: immutable'],
  },
  {
    path: '/directory/*/test.html',
    headers: ['X-Frame-Options: test'],
  },
  {
    path: '/with-colon',
    headers: ['Custom-header: http://www.example.com'],
  },
]

it('returns headers matching given header rules', async () => {
  const fixture = new Fixture().withHeadersFile({ headers })
  const directory = await fixture.create()

  const headersFile = path.resolve(directory, '_headers')
  const rules = await parseHeaders({ configHeaders: [], headersFiles: [headersFile] })

  expect(headersForPath(rules, '/')).toEqual({
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/static-path/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  expect(headersForPath(rules, '/static-path')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  expect(headersForPath(rules, '/placeholder/index.html')).toEqual({
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/placeholder/_next/static/chunks/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  expect(headersForPath(rules, '/directory/placeholder/test.html')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'test',
  })

  await fixture.destroy()
})
