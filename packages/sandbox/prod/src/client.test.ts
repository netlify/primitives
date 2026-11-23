import { expect, test } from 'vitest'

import { base64, callOf, client, json, mockFetch, payload } from './test_helpers.js'
import { MissingSandboxEnvironmentError, SandboxError } from './error.js'
import { Client } from './client.js'

test('creates a sandbox through the site API', async () => {
  const fetch = mockFetch(json(payload, 201))
  const sandbox = await client(fetch).create({ memory: 4096 })
  const call = callOf(fetch, 0)

  expect(call.url).toBe(`https://api.netlify.com/api/v1/sites/${payload.site_id}/sandboxes`)
  expect(call.method).toBe('POST')
  expect(call.headers.authorization).toBe('Bearer token')
  expect(call.body).toStrictEqual({ memory_mb: 4096 })

  expect(sandbox.id).toBe(payload.id)
  expect(sandbox.hostname).toBe(payload.hostname)
  expect(sandbox.createdAt).toStrictEqual(new Date(payload.created_at))
})

test('sends a network policy through verbatim', async () => {
  const fetch = mockFetch(json(payload, 201))

  await client(fetch).create({
    network: {
      egress: 'allowlist',
      allow: ['github.com'],
      secrets: [{ env: 'TOKEN', hosts: ['api.github.com'], methods: ['POST'] }],
    },
  })

  expect(callOf(fetch, 0).body.network).toStrictEqual({
    egress: 'allowlist',
    allow: ['github.com'],
    secrets: [{ env: 'TOKEN', hosts: ['api.github.com'], methods: ['POST'] }],
  })
})

// Egress is open by default, so saying nothing has to send nothing rather than
// an empty policy the API would read as a narrower one.
test('sends no network field when none was asked for', async () => {
  const fetch = mockFetch(json(payload, 201))

  await client(fetch).create({ memory: 4096 })

  expect(callOf(fetch, 0).body).toStrictEqual({ memory_mb: 4096 })
})

test('leaves unset resources out of the request rather than sending zeros', async () => {
  const fetch = mockFetch(json(payload, 201))
  await client(fetch).create()

  // A zero is a size the API refuses, so an option nobody set has to be absent
  // on the wire rather than sent as one.
  expect(callOf(fetch, 0).body).toStrictEqual({})
})

test('carries the request ID on a failure, so a caller can quote it', async () => {
  const fetch = mockFetch(new Response('Not Found', { status: 404, headers: { 'x-nf-request-id': 'abc123' } }))

  const error = await client(fetch)
    .delete(payload.id)
    .catch((err: unknown) => err)

  expect(error).toBeInstanceOf(SandboxError)
  expect((error as SandboxError).status).toBe(404)
  expect((error as SandboxError).code).toBe('not_found')
  expect((error as SandboxError).requestID).toBe('abc123')
})

test('puts the reason the API gave in the error', async () => {
  const fetch = mockFetch(json({ code: 409, message: 'the sandbox is starting or stopping, try again' }, 409))

  const error = await client(fetch)
    .snapshot(payload.id)
    .catch((err: unknown) => err)

  expect((error as SandboxError).code).toBe('conflict')
  expect((error as SandboxError).message).toMatch(
    /^the sandbox is starting or stopping, try again \(POST .* responded with 409\)$/,
  )
})

// Nothing is resolved until a call is made, so an unconfigured client is only a
// problem at the point it is used.
test('reports what is missing when neither options nor the environment supply it', async () => {
  const client_ = new Client({ fetch: mockFetch() })

  await expect(client_.create()).rejects.toThrow(MissingSandboxEnvironmentError)
  await expect(client_.create()).rejects.toThrow('siteID, token')
})

test('takes the token and site from the environment', async () => {
  const fetch = mockFetch(json(payload, 201))

  globalThis.netlifySandboxContext = base64({
    apiURL: 'https://api.example.com',
    siteID: payload.site_id,
    token: 'edge-token',
  })

  try {
    await new Client({ fetch }).create()
  } finally {
    globalThis.netlifySandboxContext = undefined
  }

  const call = callOf(fetch, 0)

  expect(call.url).toBe(`https://api.example.com/api/v1/sites/${payload.site_id}/sandboxes`)
  expect(call.headers.authorization).toBe('Bearer edge-token')
})

test('an explicit token wins over the environment', async () => {
  const fetch = mockFetch(json(payload, 201))

  globalThis.netlifySandboxContext = base64({ siteID: payload.site_id, token: 'edge-token' })

  try {
    await new Client({ fetch, token: 'explicit', siteID: payload.site_id }).create()
  } finally {
    globalThis.netlifySandboxContext = undefined
  }

  expect(callOf(fetch, 0).headers.authorization).toBe('Bearer explicit')
})

// The platform replaces the token between requests, so a client that outlives
// one must not still be sending the token it saw first.
test('picks up a token that changed since the last call', async () => {
  const fetch = mockFetch(json(payload, 201), json(payload, 201))
  const client_ = new Client({ fetch })

  try {
    globalThis.netlifySandboxContext = base64({ siteID: payload.site_id, token: 'first' })
    await client_.create()

    globalThis.netlifySandboxContext = base64({ siteID: payload.site_id, token: 'second' })
    await client_.create()
  } finally {
    globalThis.netlifySandboxContext = undefined
  }

  expect(callOf(fetch, 0).headers.authorization).toBe('Bearer first')
  expect(callOf(fetch, 1).headers.authorization).toBe('Bearer second')
})
