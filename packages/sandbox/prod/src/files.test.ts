import { expect, test } from 'vitest'

import { SandboxError } from './error.js'
import { client, json, mockFetch, payload, type FetchMock } from './test_helpers.js'

const API = `https://${payload.hostname}/.netlify/sandbox`

// requestOf reads a recorded file request back. Unlike a command, its body
// isn't JSON.
const requestOf = (fetch: FetchMock, index: number) => {
  const [input, init = {}] = fetch.mock.calls[index]

  return { url: input as string, ...(init as RequestInit & { duplex?: string }) }
}

const entry = { name: 'notes.txt', type: 'file', size: 5, mode: '644', modified_at: '2026-11-25T10:00:00Z' }

test('reads a file as text, as bytes and as a stream', async () => {
  const bytes = new Uint8Array([0, 255, 128, 10])
  const fetch = mockFetch(json(payload, 201), new Response('héllo'), new Response(bytes), new Response(bytes))
  const sandbox = await client(fetch).create()

  await expect(sandbox.files.read('notes.txt')).resolves.toBe('héllo')
  await expect(sandbox.files.readBytes('/work/blob.bin')).resolves.toStrictEqual(bytes)

  const stream = await sandbox.files.stream('/work/blob.bin')
  expect(new Uint8Array(await new Response(stream).arrayBuffer())).toStrictEqual(bytes)

  expect(requestOf(fetch, 1)).toMatchObject({ url: `${API}/files?path=notes.txt`, method: 'GET' })
  expect(requestOf(fetch, 2).url).toBe(`${API}/files?path=%2Fwork%2Fblob.bin`)
  expect(requestOf(fetch, 1).headers).toStrictEqual({ authorization: 'Bearer token' })
})

test('writes the contents as the request body, whatever they are', async () => {
  const fetch = mockFetch(json(payload, 201), json({ size: 3 }), json({ size: 4 }), json({ size: 2 }))
  const sandbox = await client(fetch).create()
  const bytes = new Uint8Array([0, 255, 128, 10])
  const stream = new Blob(['ab']).stream()

  await sandbox.files.write('/work/a b&c.txt', 'one')
  await sandbox.files.write('run.sh', bytes, { mode: 0o755 })
  await sandbox.files.write('big.bin', stream)

  expect(requestOf(fetch, 1)).toMatchObject({
    url: `${API}/files?path=%2Fwork%2Fa+b%26c.txt`,
    method: 'PUT',
    body: 'one',
    headers: { authorization: 'Bearer token', 'content-type': 'application/octet-stream' },
  })
  expect(requestOf(fetch, 1).duplex).toBeUndefined()
  expect(requestOf(fetch, 2)).toMatchObject({ url: `${API}/files?path=run.sh&mode=755`, body: bytes })

  // A stream is only sent as it is read when fetch is asked to.
  expect(requestOf(fetch, 3)).toMatchObject({ body: stream, duplex: 'half' })
})

test('lists and describes entries', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json({ entries: [entry, { ...entry, name: 'src', type: 'directory', mode: '755' }] }),
    json(entry),
  )
  const sandbox = await client(fetch).create()
  const expected = { name: 'notes.txt', type: 'file', size: 5, mode: 0o644, modifiedAt: new Date(entry.modified_at) }

  await expect(sandbox.files.list('/work')).resolves.toStrictEqual([
    expected,
    { ...expected, name: 'src', type: 'directory', mode: 0o755 },
  ])
  await expect(sandbox.files.stat('/work/notes.txt')).resolves.toStrictEqual(expected)

  expect(requestOf(fetch, 1).url).toBe(`${API}/files/entries?path=%2Fwork`)
  expect(requestOf(fetch, 2).url).toBe(`${API}/files/info?path=%2Fwork%2Fnotes.txt`)
})

test('lists the root when no path is given', async () => {
  const fetch = mockFetch(json(payload, 201), json({ entries: [] }))
  const sandbox = await client(fetch).create()

  await expect(sandbox.files.list()).resolves.toStrictEqual([])
  expect(requestOf(fetch, 1).url).toBe(`${API}/files/entries?path=%2F`)
})

test('says whether a path exists, and rejects when it could not tell', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(entry),
    json({ error: '/nope: no such file or directory' }, 404),
    json({ error: 'boom' }, 502),
  )
  const sandbox = await client(fetch).create()

  await expect(sandbox.files.exists('notes.txt')).resolves.toBe(true)
  await expect(sandbox.files.exists('/nope')).resolves.toBe(false)
  await expect(sandbox.files.exists('/nope')).rejects.toMatchObject({ code: 'unavailable' })
})

test('removes a file, or a directory and everything in it', async () => {
  const fetch = mockFetch(json(payload, 201), new Response(null, { status: 204 }), new Response(null, { status: 204 }))
  const sandbox = await client(fetch).create()

  await sandbox.files.remove('notes.txt')
  await sandbox.files.remove('/work/src', { recursive: true })

  expect(requestOf(fetch, 1)).toMatchObject({ url: `${API}/files?path=notes.txt`, method: 'DELETE' })
  expect(requestOf(fetch, 2).url).toBe(`${API}/files?path=%2Fwork%2Fsrc&recursive=true`)
})

test.each([
  [404, 'not_found'],
  [409, 'file_error'],
  [507, 'file_error'],
  [502, 'unavailable'],
])('turns a %i into an error with the reason and the code %s', async (status, code) => {
  const fetch = mockFetch(json(payload, 201), json({ error: '/work: is a directory' }, status))
  const sandbox = await client(fetch).create()
  const error = await sandbox.files.read('/work').catch((err: unknown) => err)

  expect(error).toBeInstanceOf(SandboxError)
  expect((error as SandboxError).code).toBe(code)
  expect((error as SandboxError).status).toBe(status)
  expect((error as SandboxError).message).toContain('/work: is a directory')
})

test('rejects with a SandboxError when the request never gets an answer', async () => {
  const fetch = mockFetch(json(payload, 201))
  const sandbox = await client(fetch).create()
  const failure = new TypeError('fetch failed')

  fetch.mockRejectedValueOnce(failure)

  const call = sandbox.files.read('notes.txt')

  await expect(call).rejects.toBeInstanceOf(SandboxError)
  await expect(call).rejects.toMatchObject({
    code: 'unavailable',
    message: `GET ${API}/files?path=notes.txt could not be sent: fetch failed`,
    cause: failure,
  })
})

test('rejects with the reason given when the caller aborts', async () => {
  const fetch = mockFetch(json(payload, 201))
  const sandbox = await client(fetch).create()
  const controller = new AbortController()
  const reason = new Error('changed my mind')

  controller.abort(reason)
  fetch.mockRejectedValueOnce(reason)

  await expect(sandbox.files.read('notes.txt', { signal: controller.signal })).rejects.toBe(reason)
})
