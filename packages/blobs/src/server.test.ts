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

  await expect(async () => await blobs.get('some-key')).rejects.toThrowError(
    'Netlify Blobs has generated an internal error (403 status code)',
  )

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
  expect(artists.directories).toEqual(['coldplay', 'phoenix'])

  const coldplayAlbums = await blobs.list({ directories: true, prefix: 'coldplay/' })

  expect(coldplayAlbums.blobs).toEqual([])
  expect(coldplayAlbums.directories).toEqual(['coldplay/a-rush-of-blood-to-the-head', 'coldplay/parachutes'])

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
