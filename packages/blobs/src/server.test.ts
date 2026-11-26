import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import { env, version as nodeVersion } from 'node:process'

import semver from 'semver'
import tmp from 'tmp-promise'
import { test, expect, beforeAll, afterEach } from 'vitest'

import { getDeployStore, getStore, listStores } from './main.js'
import { BlobsServer } from './server.js'

beforeAll(async () => {
  if (semver.lt(nodeVersion, '18.0.0')) {
    const nodeFetch = await import('node-fetch')

    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.fetch = nodeFetch.default
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Request = nodeFetch.Request
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Response = nodeFetch.Response
    // @ts-expect-error Expected type mismatch between native implementation and node-fetch
    globalThis.Headers = nodeFetch.Headers
  }
})

afterEach(() => {
  delete env.NETLIFY_BLOBS_CONTEXT
})

const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
const token = 'my-very-secret-token'

test('Reads and writes from the file system', async () => {
  const metadata = {
    features: {
      blobs: true,
      functions: true,
    },
    name: 'Netlify',
  }

  // Store #1: Edge access
  const server1Ops: { type: string; url: string }[] = []
  const directory1 = await tmp.dir()
  const server1 = new BlobsServer({
    directory: directory1.path,
    onRequest: ({ type, url }) => server1Ops.push({ type, url }),
    token,
  })

  const { port: port1 } = await server1.start()
  const store1 = getStore({
    edgeURL: `http://localhost:${port1}`,
    name: 'mystore1',
    token,
    siteID,
  })

  // Store #2: API access
  const directory2 = await tmp.dir()
  const server2 = new BlobsServer({
    directory: directory2.path,
    token,
  })
  const { port: port2 } = await server2.start()
  const store2 = getStore({
    apiURL: `http://localhost:${port2}`,
    name: 'mystore2',
    token,
    siteID,
  })

  for (const store of [store1, store2]) {
    const list1 = await store.list()
    expect(list1.blobs).toEqual([])
    expect(list1.directories).toEqual([])

    await store.set('simple-key', 'value 1')
    expect(await store.get('simple-key')).toBe('value 1')

    await store.set('simple-key', 'value 2', { metadata })
    expect(await store.get('simple-key')).toBe('value 2')

    const list2 = await store.list()
    expect(list2.blobs.length).toBe(1)
    expect(list2.blobs[0].key).toBe('simple-key')
    expect(list2.directories).toEqual([])

    await store.set('parent/child', 'value 3')
    expect(await store.get('parent/child')).toBe('value 3')
    expect(await store.get('parent')).toBe(null)

    const entry = await store.getWithMetadata('simple-key')
    expect(entry?.metadata).toEqual(metadata)

    const entryMetadata = await store.getMetadata('simple-key')
    expect(entryMetadata?.metadata).toEqual(metadata)

    const childEntryMetdata = await store.getMetadata('parent/child')
    expect(childEntryMetdata?.metadata).toEqual({})

    expect(await store.getWithMetadata('does-not-exist')).toBe(null)
    expect(await store.getMetadata('does-not-exist')).toBe(null)

    await store.delete('simple-key')
    expect(await store.get('simple-key')).toBe(null)
    expect(await store.getMetadata('simple-key')).toBe(null)
    expect(await store.getWithMetadata('simple-key')).toBe(null)

    const list3 = await store.list()
    expect(list3.blobs.length).toBe(1)
    expect(list3.blobs[0].key).toBe('parent/child')
    expect(list3.directories).toEqual([])
  }

  const urls = server1Ops.map(({ url }) => url)

  expect(urls.every((url) => url.startsWith(`/${siteID}/`))).toBeTruthy()

  const operations = server1Ops.map(({ type }) => type)

  expect(operations).toEqual([
    'list',
    'set',
    'get',
    'set',
    'get',
    'list',
    'set',
    'get',
    'get',
    'get',
    'getMetadata',
    'getMetadata',
    'get',
    'getMetadata',
    'delete',
    'get',
    'getMetadata',
    'get',
    'list',
  ])

  await server1.stop()
  await fs.rm(directory1.path, { force: true, recursive: true })

  await server2.stop()
  await fs.rm(directory2.path, { force: true, recursive: true })
})

test('Works with weird keys -- valid blob keys, tricky in filesystems', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()
  const store = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'store',
    token,
    siteID,
  })

  // valid as keys and store names
  const pipes = 'valid|key'
  const question = 'key?'
  const glob = '*hehe*'
  const con = 'CON'
  const emoji = '🐰'
  const angles = '<>'
  // valid only as keys
  const slashes = 'a///b'
  const namespace = 'name:space'
  for (const key of [pipes, question, glob, con, angles, emoji, slashes, namespace]) {
    try {
      await store.set(key, 'value')
      expect(await store.get(key)).toBe('value')
    } catch (error) {
      console.warn(`couldn't set valid key of "${key}"`)
      throw error
    }
  }

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Separates keys from different stores', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()

  const store1 = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'mystore1',
    token,
    siteID,
  })
  const store2 = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'mystore2',
    token,
    siteID,
  })
  const key = 'my-key'

  await store1.set(key, 'value 1 for store 1')
  await store2.set(key, 'value 1 for store 2')

  expect(await store1.get(key)).toBe('value 1 for store 1')
  expect(await store2.get(key)).toBe('value 1 for store 2')

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('If a token is set, rejects any requests with an invalid `authorization` header', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()
  const blobs = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'mystore',
    token: 'another token',
    siteID,
  })

  await expect(blobs.get('some-key')).rejects.toThrow('Netlify Blobs has generated an internal error (403 status code)')

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Lists entries', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()
  const blobs = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'mystore',
    token,
    siteID,
  })
  const songs: Record<string, string> = {
    'coldplay/parachutes/shiver': "I'll always be waiting for you",
    'coldplay/parachutes/spies': 'And the spies came out of the water',
    'coldplay/parachutes/trouble': 'And I:I never meant to cause you trouble',
    'coldplay/a-rush-of-blood-to-the-head/politik': 'Give me heart and give me soul',
    'coldplay/a-rush-of-blood-to-the-head/in-my-place': 'How long must you wait for it?',
    'coldplay/a-rush-of-blood-to-the-head/the-scientist': 'Questions of science, science and progress',
    'phoenix/united/too-young': "Oh rainfalls and hard times coming they won't leave me tonight",
    'phoenix/united/party-time': 'Summertime is gone',
    'phoenix/ti-amo/j-boy': 'Something in the middle of the side of the store',
    'phoenix/ti-amo/fleur-de-lys': 'No rest till I get to you, no rest till I get to you',
  }

  for (const title in songs) {
    await blobs.set(title, songs[title])
  }

  const allSongs = await blobs.list()

  for (const title in songs) {
    const match = allSongs.blobs.find((blob) => blob.key === title)

    expect(match).toBeTruthy()
  }

  const coldplaySongs = await blobs.list({ prefix: 'coldplay/' })

  for (const title in songs) {
    if (!title.startsWith('coldplay/')) {
      continue
    }

    const match = coldplaySongs.blobs.find((blob) => blob.key === title)

    expect(match).toBeTruthy()
  }

  const parachutesSongs = await blobs.list({ prefix: 'coldplay/parachutes/' })

  for (const title in songs) {
    if (!title.startsWith('coldplay/parachutes/')) {
      continue
    }

    const match = parachutesSongs.blobs.find((blob) => blob.key === title)

    expect(match).toBeTruthy()
  }

  const fooFightersSongs = await blobs.list({ prefix: 'foo-fighters/' })

  expect(fooFightersSongs.blobs).toEqual([])

  const artists = await blobs.list({ directories: true })

  expect(artists.blobs).toEqual([])
  expect(artists.directories).toEqual(['coldplay/', 'phoenix/'])

  const coldplayAlbums = await blobs.list({ directories: true, prefix: 'coldplay/' })

  expect(coldplayAlbums.blobs).toEqual([])
  expect(coldplayAlbums.directories).toEqual(['coldplay/a-rush-of-blood-to-the-head/', 'coldplay/parachutes/'])

  const parachutesSongs2 = await blobs.list({ directories: true, prefix: 'coldplay/parachutes/' })

  for (const title in songs) {
    if (!title.startsWith('coldplay/parachutes/')) {
      continue
    }

    const match = parachutesSongs2.blobs.find((blob) => blob.key === title)

    expect(match).toBeTruthy()
  }

  expect(parachutesSongs2.directories).toEqual([])
})

test('Works with a deploy-scoped store', async () => {
  const deployID = '655f77a1b48f470008e5879a'
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()

  const store = getDeployStore({
    deployID,
    edgeURL: `http://localhost:${port}`,
    region: 'us-east-1',
    token,
    siteID,
  })
  const key = 'my-key'

  await store.set(key, 'value 1 for store 1')

  expect(await store.get(key)).toBe('value 1 for store 1')

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Lists site stores', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()

  const store1 = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'coldplay',
    token,
    siteID,
  })

  await store1.set('parachutes/shiver', "I'll always be waiting for you")
  await store1.set('parachutes/spies', 'And the spies came out of the water')
  await store1.set('parachutes/trouble', 'And I:I never meant to cause you trouble')
  await store1.set('a-rush-of-blood-to-the-head/politik', 'Give me heart and give me soul')
  await store1.set('a-rush-of-blood-to-the-head/in-my-place', 'How long must you wait for it?')
  await store1.set('a-rush-of-blood-to-the-head/the-scientist', 'Questions of science, science and progress')

  const store2 = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'phoenix',
    token,
    siteID,
  })

  await store2.set('united/too-young', "Oh rainfalls and hard times coming they won't leave me tonight")
  await store2.set('united/party-time', 'Summertime is gone')
  await store2.set('ti-amo/j-boy', 'Something in the middle of the side of the store')
  await store2.set('ti-amo/fleur-de-lys', 'No rest till I get to you, no rest till I get to you')

  const store3 = getDeployStore({
    deployID: '655f77a1b48f470008e5879a',
    edgeURL: `http://localhost:${port}`,
    region: 'us-east-1',
    token,
    siteID,
  })

  await store3.set('not-a-song', "I'm a deploy, not a song")

  const { stores } = await listStores({
    edgeURL: `http://localhost:${port}`,
    token,
    siteID,
  })

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })

  expect(stores).toStrictEqual(['coldplay', 'phoenix'])
})

test('Returns a signed URL or the blob directly based on the request parameters', async () => {
  const siteID = '9a003659-aaaa-0000-aaaa-63d3720d8621'
  const token = 'some token'
  const value = 'value 1'
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })

  const { port } = await server.start()
  const store = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'my-store',
    token,
    siteID,
  })

  await store.set('key-1', value)

  // When reading through a legacy API endpoint, we should get a signed URL.
  const res1 = await fetch(`http://localhost:${port}/api/v1/sites/${siteID}/blobs/key-1?context=site:my-store`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const { url: url1 } = await res1.json()
  const data1 = await fetch(url1)

  expect(await data1.text()).toBe(value)

  // When reading through a new API endpoint, we should get the blob data by
  // default.
  const res2 = await fetch(`http://localhost:${port}/api/v1/blobs/${siteID}/site:my-store/key-1`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  expect(await res2.text()).toBe(value)

  // When reading through a new API endpoint and requesting a signed URL, we
  // should get one.
  const res3 = await fetch(`http://localhost:${port}/api/v1/blobs/${siteID}/site:my-store/key-1`, {
    headers: {
      accept: 'application/json;type=signed-url',
      authorization: `Bearer ${token}`,
    },
  })
  const { url: url3 } = await res3.json()
  const data3 = await fetch(url3)

  expect(await data3.text()).toBe(value)

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Accepts deploy-scoped stores with the region defined in the context', async () => {
  const deployID = '655f77a1b48f470008e5879a'
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()

  const context = {
    deployID,
    edgeURL: `http://localhost:${port}`,
    primaryRegion: 'us-east-1',
    siteID,
    token,
  }

  env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

  const store = getDeployStore()
  const key = 'my-key'
  const value = 'hello from a deploy store'

  await store.set(key, value)

  expect(await store.get(key)).toBe(value)

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Handles conditional writes', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()
  const deployID = '655f77a1b48f470008e5879a'
  const key = 'conditional-key'
  const value1 = 'value 1'
  const value2 = 'value 2'
  const value3 = 'value 3'

  const context = {
    deployID,
    edgeURL: `http://localhost:${port}`,
    primaryRegion: 'us-east-1',
    siteID,
    token,
  }

  env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(context)).toString('base64')

  const store1 = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'my-store',
    token,
    siteID,
  })

  const res1 = await store1.set(key, value1, { onlyIfNew: true })

  expect(res1.modified).toBe(true)
  expect(await store1.get(key)).toBe(value1)

  const res2 = await store1.set(key, value2, { onlyIfNew: true })

  expect(res2.modified).toBe(false)
  expect(await store1.get(key)).toBe(value1)

  const res3 = await store1.set(key, value3, { onlyIfMatch: `"wrong-etag"` })
  expect(res3.modified).toBe(false)
  expect(await store1.get(key)).toBe(value1)

  const res4 = await store1.set(key, value3, { onlyIfMatch: res1.etag })
  expect(res4.modified).toBe(true)
  expect(await store1.get(key)).toBe(value3)

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

test('Deletes all blobs from a store', async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({
    directory: directory.path,
    token,
  })
  const { port } = await server.start()
  const store = getStore({
    edgeURL: `http://localhost:${port}`,
    name: 'my-store',
    token,
    siteID,
  })

  const metadata = {
    name: 'test-metadata',
  }

  // Add multiple blobs to the store
  await store.set('key1', 'value 1')
  await store.set('key2', 'value 2', { metadata })
  await store.set('parent/child', 'value 3')
  await store.set('parent/another/nested', 'value 4')

  // Verify blobs exist
  const list1 = await store.list()
  expect(list1.blobs.length).toBe(4)

  // Verify metadata exists
  const entry = await store.getMetadata('key2')
  expect(entry?.metadata).toEqual(metadata)

  const deleteResult1 = await store.deleteAll()
  expect(deleteResult1.deletedBlobs).toBe(4)

  const list2 = await store.list()
  expect(list2.blobs.length).toBe(0)

  const deleteResult2 = await store.deleteAll()
  expect(deleteResult2.deletedBlobs).toBe(0)

  expect(await store.get('key1')).toBe(null)
  expect(await store.get('key2')).toBe(null)
  expect(await store.get('parent/child')).toBe(null)
  expect(await store.get('parent/another/nested')).toBe(null)
  expect(await store.getMetadata('key2')).toBe(null)

  await server.stop()
  await fs.rm(directory.path, { force: true, recursive: true })
})

const startServer = async () => {
  const directory = await tmp.dir()
  const server = new BlobsServer({ directory: directory.path, token })
  const { port } = await server.start()
  const options = { edgeURL: `http://localhost:${port}`, token, siteID }

  return {
    options,
    port,
    store: getStore({ ...options, name: 'my-store' }),
    stop: async () => {
      await server.stop()
      await fs.rm(directory.path, { force: true, recursive: true })
    },
  }
}

test('Returns the ETag on reads and answers conditional reads', async () => {
  const { port, stop, store } = await startServer()

  const { etag } = await store.set('key', 'value')
  expect(etag).toBeTruthy()

  expect((await store.getMetadata('key'))?.etag).toBe(etag)
  expect((await store.getWithMetadata('key'))?.etag).toBe(etag)

  const fresh = await store.getWithMetadata('key', { etag })
  expect(fresh?.data).toBe(null)
  expect(fresh?.etag).toBe(etag)

  const stale = await store.getWithMetadata('key', { etag: '"stale"' })
  expect(stale?.data).toBe('value')

  const conditionalRead = async (ifNoneMatch: string) => {
    const res = await fetch(`http://localhost:${port}/${siteID}/site:my-store/key`, {
      headers: { authorization: `Bearer ${token}`, 'if-none-match': ifNoneMatch },
    })

    return res.status
  }

  expect(await conditionalRead(`"a,b", ${etag}`)).toBe(304)
  expect(await conditionalRead('*')).toBe(304)
  expect(await conditionalRead(`"with,${etag},inside"`)).toBe(200)
  expect(await conditionalRead('"stale", *')).toBe(200)

  // As in production, the ETag is the MD5 of the content, so the same content keeps it.
  expect(etag).toBe('"2063c1608d6e0baf80249c42e2be5804"')
  expect((await store.set('key', 'value')).etag).toBe(etag)
  expect((await store.set('key', 'other')).etag).not.toBe(etag)

  await stop()
})

test('Treats a blob without metadata as present, and a write without metadata as clearing it', async () => {
  const { port, stop, store } = await startServer()

  // A write that carries no metadata header at all, as a client other than
  // the SDK might send.
  const res = await fetch(`http://localhost:${port}/${siteID}/site:my-store/plain`, {
    body: 'value',
    headers: { authorization: `Bearer ${token}` },
    method: 'PUT',
  })
  expect(res.status).toBe(200)
  expect(await store.getMetadata('plain', {})).not.toBe(null)

  await store.set('key', 'value', { metadata: { name: 'Netlify' } })
  await store.set('key', 'value')
  expect((await store.getMetadata('key'))?.metadata).toEqual({})

  await stop()
})

test('Refuses a write conditioned on the ETag of a missing key', async () => {
  const { stop, store } = await startServer()

  await expect(store.set('missing', 'value', { onlyIfMatch: '"some-etag"' })).rejects.toThrow(/404/)
  expect(await store.get('missing')).toBe(null)

  await stop()
})

test('Decodes keys once and lists them as written', async () => {
  const { stop, store } = await startServer()
  const keys = ['with space', 'ünïcödé', 'plus+sign', 'nested/with space']

  for (const key of keys) {
    await store.set(key, key)
    expect(await store.get(key)).toBe(key)
  }

  const { blobs } = await store.list()
  expect(blobs.map((blob) => blob.key)).toEqual(['nested/with space', 'plus+sign', 'with space', 'ünïcödé'])

  // `%ce` decodes to a byte that is not valid UTF-8 on its own.
  await expect(store.set('per%cent', 'value')).rejects.toThrow(/400/)

  await stop()
})

test('Lists keys in byte order', async () => {
  const { stop, store } = await startServer()

  // `-` sorts before `/`, which a directory-by-directory walk gets wrong.
  for (const key of ['c', 'a/z', 'a-b', 'B']) {
    await store.set(key, key)
  }

  const { blobs } = await store.list()
  expect(blobs.map((blob) => blob.key)).toEqual(['B', 'a-b', 'a/z', 'c'])

  await stop()
})

test('Does not list stores without blobs', async () => {
  const { options, stop } = await startServer()

  const kept = getStore({ ...options, name: 'kept' })
  const emptied = getStore({ ...options, name: 'emptied' })

  await kept.set('key', 'value')
  await emptied.set('nested/key', 'value')
  await emptied.delete('nested/key')

  expect((await listStores(options)).stores).toEqual(['kept'])

  await stop()
})

test('Refuses paths that would leave the store', async () => {
  const { port, stop } = await startServer()

  for (const path of ['%2E%2E/%2E%2E/escape', 'a/%2E%2E%2F%2E%2E%2Fescape']) {
    const res = await fetch(`http://localhost:${port}/${siteID}/site:my-store/${path}`, {
      body: 'value',
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
    })
    expect({ path, status: res.status }).toEqual({ path, status: 400 })
  }

  // A site ID or a store name is one segment, so an encoded slash in it is refused.
  for (const path of [`${siteID}/%2E%2E%2F%2E%2E%2Fescape/key`, `${siteID}%2F%2E%2E%2F%2E%2E/site:my-store/key`]) {
    const res = await fetch(`http://localhost:${port}/${path}`, {
      body: 'value',
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
    })
    expect({ path, status: res.status }).toEqual({ path, status: 400 })
  }

  await stop()
})
