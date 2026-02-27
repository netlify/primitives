import { promises as fs } from 'node:fs'

import { Client } from 'pg'
import tmp from 'tmp-promise'
import { test, expect, afterEach } from 'vitest'

import { NetlifyDB } from './main.js'

let server: NetlifyDB | undefined
let tmpDir: tmp.DirectoryResult | undefined

afterEach(async () => {
  if (server) {
    await server.stop()
    server = undefined
  }

  if (tmpDir) {
    await fs.rm(tmpDir.path, { force: true, recursive: true })
    tmpDir = undefined
  }
})

test('Starts a server and returns a connection string', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  expect(connectionString).toMatch(/^postgres:\/\/localhost:\d+\/postgres$/)
})

test('Uses the specified port when provided', async () => {
  const port = 15432
  server = new NetlifyDB({ port })
  const connectionString = await server.start()

  expect(connectionString).toBe(`postgres://localhost:${String(port)}/postgres`)
})

test('Accepts PostgreSQL client connections', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = new Client({ connectionString })

  await client.connect()

  const result = await client.query('SELECT 1 as value')
  expect(result.rows).toHaveLength(1)

  await client.end()
})

test('Executes basic SQL queries', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = new Client({ connectionString })

  await client.connect()

  // Create a table
  await client.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL
    )
  `)

  // Insert data
  await client.query(
    `
    INSERT INTO users (name, email) VALUES ($1, $2)
  `,
    ['Alice', 'alice@example.com'],
  )

  await client.query(
    `
    INSERT INTO users (name, email) VALUES ($1, $2)
  `,
    ['Bob', 'bob@example.com'],
  )

  // Query data
  const result = await client.query<{ id: number; name: string; email: string }>('SELECT * FROM users ORDER BY id')

  expect(result.rows).toHaveLength(2)
  expect(result.rows[0].name).toBe('Alice')
  expect(result.rows[0].email).toBe('alice@example.com')
  expect(result.rows[1].name).toBe('Bob')
  expect(result.rows[1].email).toBe('bob@example.com')

  await client.end()
})

test('Supports multiple concurrent client connections', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client1 = new Client({ connectionString })
  const client2 = new Client({ connectionString })

  await client1.connect()
  await client2.connect()

  // Create table with client1
  await client1.query(`
    CREATE TABLE test_table (
      id SERIAL PRIMARY KEY,
      value TEXT
    )
  `)

  // Insert with client1
  await client1.query(`INSERT INTO test_table (value) VALUES ('from client 1')`)

  // Insert with client2
  await client2.query(`INSERT INTO test_table (value) VALUES ('from client 2')`)

  // Read from both clients
  const result1 = await client1.query('SELECT * FROM test_table ORDER BY id')
  const result2 = await client2.query('SELECT * FROM test_table ORDER BY id')

  expect(result1.rows).toHaveLength(2)
  expect(result2.rows).toHaveLength(2)

  await client1.end()
  await client2.end()
})

test('Persists data to disk when directory is provided', async () => {
  tmpDir = await tmp.dir()

  // Start server with directory
  server = new NetlifyDB({ directory: tmpDir.path })
  const connectionString1 = await server.start()

  const client1 = new Client({ connectionString: connectionString1 })

  await client1.connect()

  // Create table and insert data
  await client1.query(`
    CREATE TABLE persistent_data (
      id SERIAL PRIMARY KEY,
      message TEXT
    )
  `)
  await client1.query(`INSERT INTO persistent_data (message) VALUES ('Hello, persistence!')`)

  await client1.end()
  await server.stop()

  // Start a new server with the same directory
  server = new NetlifyDB({ directory: tmpDir.path })
  const connectionString2 = await server.start()

  const client2 = new Client({ connectionString: connectionString2 })

  await client2.connect()

  // Data should still be there
  const result = await client2.query<{ id: number; message: string }>('SELECT * FROM persistent_data')

  expect(result.rows).toHaveLength(1)
  expect(result.rows[0].message).toBe('Hello, persistence!')

  await client2.end()
})

test('Uses in-memory storage when no directory is provided', async () => {
  server = new NetlifyDB()
  const connectionString1 = await server.start()

  const client1 = new Client({ connectionString: connectionString1 })

  await client1.connect()

  // Create table and insert data
  await client1.query(`
    CREATE TABLE temp_data (
      id SERIAL PRIMARY KEY,
      value TEXT
    )
  `)
  await client1.query(`INSERT INTO temp_data (value) VALUES ('temporary')`)

  const result1 = await client1.query('SELECT * FROM temp_data')
  expect(result1.rows).toHaveLength(1)

  await client1.end()
  await server.stop()

  // Start a new server without directory - data should be gone
  server = new NetlifyDB()
  const connectionString2 = await server.start()

  const client2 = new Client({ connectionString: connectionString2 })

  await client2.connect()

  // Table should not exist
  await expect(client2.query('SELECT * FROM temp_data')).rejects.toThrow()

  await client2.end()
})

test('Delivers LISTEN/NOTIFY across separate connections', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener = new Client({ connectionString })
  const notifier = new Client({ connectionString })

  await listener.connect()
  await notifier.connect()

  const received: { channel: string; payload: string }[] = []

  listener.on('notification', (msg) => {
    received.push({ channel: msg.channel, payload: msg.payload ?? '' })
  })

  await listener.query('LISTEN test_channel')

  // Send notifications from a different connection.
  await notifier.query("NOTIFY test_channel, 'hello'")
  await notifier.query("NOTIFY test_channel, 'world'")

  // Give a brief moment for async delivery.
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(received).toEqual([
    { channel: 'test_channel', payload: 'hello' },
    { channel: 'test_channel', payload: 'world' },
  ])

  await listener.end()
  await notifier.end()
})

test('Supports UNLISTEN to stop receiving notifications', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener = new Client({ connectionString })
  const notifier = new Client({ connectionString })

  await listener.connect()
  await notifier.connect()

  const received: string[] = []

  listener.on('notification', (msg) => {
    received.push(msg.payload ?? '')
  })

  await listener.query('LISTEN test_unsub')
  await notifier.query("NOTIFY test_unsub, 'before'")
  await new Promise((resolve) => setTimeout(resolve, 200))

  await listener.query('UNLISTEN test_unsub')
  await notifier.query("NOTIFY test_unsub, 'after'")
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(received).toEqual(['before'])

  await listener.end()
  await notifier.end()
})

test('Delivers notifications to multiple listeners', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener1 = new Client({ connectionString })
  const listener2 = new Client({ connectionString })
  const notifier = new Client({ connectionString })

  await listener1.connect()
  await listener2.connect()
  await notifier.connect()

  const received1: string[] = []
  const received2: string[] = []

  listener1.on('notification', (msg) => {
    received1.push(msg.payload ?? '')
  })

  listener2.on('notification', (msg) => {
    received2.push(msg.payload ?? '')
  })

  await listener1.query('LISTEN shared_channel')
  await listener2.query('LISTEN shared_channel')

  await notifier.query("NOTIFY shared_channel, 'broadcast'")
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(received1).toEqual(['broadcast'])
  expect(received2).toEqual(['broadcast'])

  await listener1.end()
  await listener2.end()
  await notifier.end()
})

test('Cleans up subscriptions when a connection closes', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener = new Client({ connectionString })
  const notifier = new Client({ connectionString })
  const observer = new Client({ connectionString })

  await listener.connect()
  await notifier.connect()
  await observer.connect()

  const observerReceived: string[] = []

  observer.on('notification', (msg) => {
    observerReceived.push(msg.payload ?? '')
  })

  await listener.query('LISTEN cleanup_test')
  await observer.query('LISTEN cleanup_test')

  // Close the first listener.
  await listener.end()
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Notify — only the observer should receive it.
  await notifier.query("NOTIFY cleanup_test, 'after_close'")
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(observerReceived).toEqual(['after_close'])

  await notifier.end()
  await observer.end()
})

test('Handles quoted channel names', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener = new Client({ connectionString })
  const notifier = new Client({ connectionString })

  await listener.connect()
  await notifier.connect()

  const received: { channel: string; payload: string }[] = []

  listener.on('notification', (msg) => {
    received.push({ channel: msg.channel, payload: msg.payload ?? '' })
  })

  await listener.query('LISTEN "MyChannel"')
  await notifier.query(`NOTIFY "MyChannel", 'test'`)
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(received).toEqual([{ channel: 'MyChannel', payload: 'test' }])

  await listener.end()
  await notifier.end()
})

test('Stops the server cleanly', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  // Verify server is running
  const client = new Client({ connectionString })

  await client.connect()
  await client.end()

  // Stop the server
  await server.stop()
  server = undefined

  // New connections should fail
  const client2 = new Client({ connectionString })

  await expect(client2.connect()).rejects.toThrow()
})
