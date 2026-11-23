import { expect, test } from 'vitest'

import { SandboxError } from './error.js'
import { sizeInMB } from './size.js'
import { callOf, client, json, mockFetch, payload } from './test_helpers.js'

test.each([
  [2048, 2048],
  ['4gb', 4096],
  ['1.5gb', 1536],
])('reads %j as %d megabytes', (input, megabytes) => {
  expect(sizeInMB('memory', input)).toBe(megabytes)
})

test.each([0, -1, 1.5, '', 'lots', '4tb', '0.3gb'])('rejects %j', (input) => {
  expect(() => sizeInMB('memory', input)).toThrow(SandboxError)
  expect(() => sizeInMB('memory', input)).toThrow(/memory must be a number of megabytes/)
})

test('sends sizes given with a unit as megabytes', async () => {
  const fetch = mockFetch(json({ ...payload, memory_mb: 4096, disk_size_mb: 8192 }, 201))

  await client(fetch).create({ memory: '4gb', diskSize: '8gb' })

  expect(callOf(fetch, 0).body).toStrictEqual({ memory_mb: 4096, disk_size_mb: 8192 })
})
