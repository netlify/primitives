import { Client } from 'pg'
import { test, expect, afterEach, describe } from 'vitest'
import { NetlifyDB } from '@netlify/database-dev'

import { NetlifyDBProxy } from './main.js'

let backend: NetlifyDB | undefined
let proxy: NetlifyDBProxy | undefined

afterEach(async () => {
  if (proxy) {
    await proxy.stop()
    proxy = undefined
  }

  if (backend) {
    await backend.stop()
    backend = undefined
  }
})

async function setupBackendAndProxy(
  provisionOverride?: () => Promise<string>,
): Promise<{ backendUrl: string; proxyUrl: string }> {
  backend = new NetlifyDB({ logger: () => {} })
  const backendUrl = await backend.start()

  proxy = new NetlifyDBProxy({
    provision: provisionOverride ?? (() => Promise.resolve(backendUrl)),
    logger: () => {},
  })

  const proxyUrl = await proxy.start()

  return { backendUrl, proxyUrl }
}

describe('NetlifyDBProxy', () => {
  test('starts and returns a valid connection string', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    expect(proxyUrl).toMatch(/^postgres:\/\/127\.0\.0\.1:\d+$/)
  })

  test('accepts a client connection and runs SELECT 1', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client = new Client({ connectionString: proxyUrl })
    await client.connect()

    const result = await client.query('SELECT 1 AS value')
    expect(result.rows).toEqual([{ value: 1 }])

    await client.end()
  })

  test('provision callback is invoked on connection', async () => {
    backend = new NetlifyDB({ logger: () => {} })
    const backendUrl = await backend.start()

    let provisionCalled = false

    proxy = new NetlifyDBProxy({
      logger: () => {},
      provision: () => {
        provisionCalled = true
        return Promise.resolve(backendUrl)
      },
    })

    const proxyUrl = await proxy.start()

    const client = new Client({ connectionString: proxyUrl })
    await client.connect()
    await client.end()

    expect(provisionCalled).toBe(true)
  })

  test('handles SSL negotiation (sslmode=prefer)', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client = new Client({
      connectionString: proxyUrl,
      ssl: false,
    })
    await client.connect()

    const result = await client.query('SELECT 1 AS value')
    expect(result.rows).toEqual([{ value: 1 }])

    await client.end()
  })

  test('proxies DDL and DML operations', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client = new Client({ connectionString: proxyUrl })
    await client.connect()

    await client.query('CREATE TABLE test_table (id SERIAL PRIMARY KEY, name TEXT NOT NULL)')
    await client.query("INSERT INTO test_table (name) VALUES ('alice')")
    await client.query("INSERT INTO test_table (name) VALUES ('bob')")

    const result = await client.query('SELECT name FROM test_table ORDER BY id')
    expect(result.rows).toEqual([{ name: 'alice' }, { name: 'bob' }])

    await client.end()
  })

  test('supports multiple concurrent connections', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client1 = new Client({ connectionString: proxyUrl })
    const client2 = new Client({ connectionString: proxyUrl })

    await client1.connect()
    await client2.connect()

    await client1.query('CREATE TABLE concurrent_test (id SERIAL PRIMARY KEY, val INT)')
    await client1.query('INSERT INTO concurrent_test (val) VALUES (1)')
    await client2.query('INSERT INTO concurrent_test (val) VALUES (2)')

    const result = await client1.query('SELECT val FROM concurrent_test ORDER BY val')
    expect(result.rows).toEqual([{ val: 1 }, { val: 2 }])

    await client1.end()
    await client2.end()
  })

  test('provisioning failure sends PG error to client', async () => {
    proxy = new NetlifyDBProxy({
      logger: () => {},
      provision: () => {
        return Promise.reject(new Error('Database not found'))
      },
    })

    const proxyUrl = await proxy.start()

    const client = new Client({ connectionString: proxyUrl })

    await expect(client.connect()).rejects.toThrow()
  })

  test('clean shutdown via stop()', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client = new Client({ connectionString: proxyUrl })
    // Suppress unhandled errors from the pg client when the proxy destroys the socket
    client.on('error', () => {})
    await client.connect()

    // Verify connection works
    await client.query('SELECT 1')

    // Stop the proxy — this should destroy the client socket
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const proxyRef = proxy!
    proxy = undefined
    await proxyRef.stop()

    // The client should be disconnected
    await expect(client.query('SELECT 1')).rejects.toThrow()
  })

  test('client disconnect cleans up remote socket', async () => {
    const { proxyUrl } = await setupBackendAndProxy()

    const client = new Client({ connectionString: proxyUrl })
    await client.connect()

    await client.query('SELECT 1')
    await client.end()

    // Give a moment for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Proxy should still be running and accept new connections
    const client2 = new Client({ connectionString: proxyUrl })
    await client2.connect()
    const result = await client2.query('SELECT 1 AS value')
    expect(result.rows).toEqual([{ value: 1 }])
    await client2.end()
  })
})
