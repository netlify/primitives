import { expect, test } from 'vitest'

import { createSandbox, getSandbox } from './get_sandbox.js'
import { Snapshot } from './snapshot.js'
import { deleteSnapshot, listSnapshots } from './snapshots.js'
import { callOf, json, mockFetch, payload } from './test_helpers.js'

const snapshotPayload = {
  id: 'snap_k2wm9xbt5r0v3f7q',
  site_id: payload.site_id,
  disk_size_mb: 2048,
  created_at: '2026-11-20T12:00:00Z',
  last_used_at: '2026-11-20T12:00:00Z',
  expires_at: '2026-12-20T12:00:00Z',
}

const options = (fetch: typeof globalThis.fetch) => ({ fetch, siteID: payload.site_id, token: 'token' })

const sitePath = `https://api.netlify.com/api/v1/sites/${payload.site_id}`

test('takes a snapshot of a sandbox', async () => {
  const fetch = mockFetch(json(payload, 201), json(snapshotPayload, 201))
  const sandbox = await getSandbox('build', options(fetch))

  const snapshot = await sandbox.snapshot()
  const call = callOf(fetch, 1)

  expect(call.url).toBe(`${sitePath}/sandbox/${payload.id}/snapshots`)
  expect(call.method).toBe('POST')
  expect(call.body).toStrictEqual({})

  expect(snapshot).toBeInstanceOf(Snapshot)
  expect(snapshot.id).toBe(snapshotPayload.id)
  expect(snapshot.siteID).toBe(payload.site_id)
  expect(snapshot.diskSize).toBe(2048)
  expect(snapshot.createdAt).toStrictEqual(new Date(snapshotPayload.created_at))
  expect(snapshot.expiresAt).toStrictEqual(new Date(snapshotPayload.expires_at))
})

test('sends the expiry it was given', async () => {
  const fetch = mockFetch(json(payload, 201), json(snapshotPayload, 201))
  const sandbox = await getSandbox('build', options(fetch))

  await sandbox.snapshot({ expiresAfterSeconds: 3600 })

  expect(callOf(fetch, 1).body).toStrictEqual({ expires_after_seconds: 3600 })
})

test('creates a sandbox from a snapshot or from its ID', async () => {
  const fetch = mockFetch(json(payload, 201), json(snapshotPayload, 201), json(payload, 201), json(payload, 201))
  const sandbox = await getSandbox('build', options(fetch))
  const snapshot = await sandbox.snapshot()

  await createSandbox({ ...options(fetch), from: snapshot })
  await getSandbox('copy', { ...options(fetch), from: snapshotPayload.id })

  expect(callOf(fetch, 2).body).toStrictEqual({ from_snapshot: snapshotPayload.id })
  expect(callOf(fetch, 3).body).toStrictEqual({ name: 'copy', from_snapshot: snapshotPayload.id })
})

test('lists the snapshots of a site', async () => {
  const { expires_at: _, ...unexpiring } = snapshotPayload
  const fetch = mockFetch(json([snapshotPayload, { ...unexpiring, id: 'snap_older' }]))

  const snapshots = await listSnapshots(options(fetch))
  const call = callOf(fetch, 0)

  expect(call.url).toBe(`${sitePath}/sandbox/snapshots`)
  expect(call.method).toBe('GET')
  expect(snapshots.map((snapshot) => snapshot.id)).toStrictEqual([snapshotPayload.id, 'snap_older'])
  expect(snapshots[1].expiresAt).toBeUndefined()
})

test('a snapshot deletes itself', async () => {
  const fetch = mockFetch(json([snapshotPayload]), new Response(null, { status: 204 }))
  const [snapshot] = await listSnapshots(options(fetch))

  await snapshot.delete()

  expect(callOf(fetch, 1).url).toBe(`${sitePath}/sandbox/snapshots/${snapshotPayload.id}`)
  expect(callOf(fetch, 1).method).toBe('DELETE')
})

test('deletes a snapshot by its ID', async () => {
  const fetch = mockFetch(new Response(null, { status: 204 }))

  await deleteSnapshot(snapshotPayload.id, options(fetch))

  const call = callOf(fetch, 0)

  expect(call.url).toBe(`${sitePath}/sandbox/snapshots/${snapshotPayload.id}`)
  expect(call.method).toBe('DELETE')
})
