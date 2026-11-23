import { afterEach, describe, expect, test, vi } from 'vitest'

import { SandboxConfigMismatchError, SandboxError } from './error.js'
import { createSandbox, deleteSandbox, getSandbox } from './get_sandbox.js'
import { base64, callOf, json, mockFetch, payload } from './test_helpers.js'

const environment = { apiURL: 'https://api.netlify.com', siteID: payload.site_id, token: 'edge-token' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSandbox', () => {
  test('resolves a sandbox by name', async () => {
    const fetch = mockFetch(json(payload))
    const sandbox = await getSandbox('build', { fetch, siteID: payload.site_id, token: 'token' })

    expect(sandbox.id).toBe(payload.id)
    expect(callOf(fetch, 0).body).toStrictEqual({ name: 'build' })
  })

  test('needs a name, and says what to call without one', async () => {
    const call = (getSandbox as unknown as () => Promise<unknown>)()

    await expect(call).rejects.toThrow(SandboxError)
    await expect(call).rejects.toThrow(/use createSandbox/)
  })

  test('sends the resources it was given', async () => {
    const fetch = mockFetch(json({ ...payload, memory_mb: 4096, disk_size_mb: 8192 }))

    await getSandbox('build', {
      fetch,
      siteID: payload.site_id,
      token: 'token',
      memory: 4096,
      diskSize: 8192,
      network: { egress: 'deny_all' },
    })

    expect(callOf(fetch, 0).body).toStrictEqual({
      name: 'build',
      memory_mb: 4096,
      disk_size_mb: 8192,
      network: { egress: 'deny_all' },
    })
  })

  test('createSandbox creates a sandbox with a generated ID', async () => {
    const fetch = mockFetch(json(payload, 201))

    const sandbox = await createSandbox({ fetch, siteID: payload.site_id, token: 'token', vcpus: 2 })

    expect(callOf(fetch, 0).body).toStrictEqual({ vcpus: 2 })
    expect(sandbox.id).toBe(payload.id)
  })

  test('deleteSandbox deletes by name without resolving the sandbox first', async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }))

    await deleteSandbox('build', { fetch, siteID: payload.site_id, token: 'token' })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(callOf(fetch, 0).url).toBe(`https://api.netlify.com/api/v1/sites/${payload.site_id}/sandbox/build`)
    expect(callOf(fetch, 0).method).toBe('DELETE')
  })

  test('takes the site and token from the environment', async () => {
    vi.stubEnv('NETLIFY_SANDBOX_CONTEXT', base64(environment))

    const fetch = mockFetch(json(payload))
    await getSandbox('build', { fetch })

    const { headers, url } = callOf(fetch, 0)

    expect(url).toBe(`https://api.netlify.com/api/v1/sites/${payload.site_id}/sandbox`)
    expect(headers.authorization).toBe('Bearer edge-token')
  })

  test('refuses to drop resources that disagree with an existing sandbox', async () => {
    const fetch = mockFetch(json(payload))
    const call = getSandbox('build', { fetch, siteID: payload.site_id, token: 'token', memory: 4096, vcpus: 4 })

    await expect(call).rejects.toThrow(SandboxConfigMismatchError)
    await expect(call).rejects.toThrow(/memory is 2048, not the 4096 asked for/)
    await expect(call).rejects.toThrow(/vcpus is 2, not the 4 asked for/)
    await expect(call).rejects.toThrow(/delete this one/)
  })

  test('accepts resources that match the sandbox it found', async () => {
    const fetch = mockFetch(json(payload))
    const sandbox = await getSandbox('build', {
      fetch,
      siteID: payload.site_id,
      token: 'token',
      memory: payload.memory_mb,
      vcpus: payload.vcpus,
    })

    expect(sandbox.memory).toBe(payload.memory_mb)
  })
})
