import { expect, test } from 'vitest'

import { getSandbox } from './get_sandbox.js'
import { callOf, json, mockFetch, payload } from './test_helpers.js'

test('deletes itself through the site API', async () => {
  const fetch = mockFetch(json(payload, 201), new Response(null, { status: 204 }))
  const sandbox = await getSandbox('build', { fetch, siteID: payload.site_id, token: 'token' })

  await sandbox.delete()

  const call = callOf(fetch, 1)

  expect(call.url).toBe(`https://api.netlify.com/api/v1/sites/${payload.site_id}/sandbox/${payload.id}`)
  expect(call.method).toBe('DELETE')
})

test('deletes itself at the end of an await using scope', async () => {
  const fetch = mockFetch(json(payload, 201), new Response(null, { status: 204 }))
  const sandbox = await getSandbox('build', { fetch, siteID: payload.site_id, token: 'token' })

  await sandbox[Symbol.asyncDispose]()

  expect(callOf(fetch, 1).method).toBe('DELETE')
})
