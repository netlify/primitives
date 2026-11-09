import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import { createConnection, type Socket } from 'node:net'

import { Client, defaults as pgDefaults } from 'pg'
import tmp from 'tmp-promise'
import { test, expect, afterEach } from 'vitest'

import { NetlifyDB } from './main.js'

let server: NetlifyDB | undefined
let tmpDir: tmp.DirectoryResult | undefined

const clients: Client[] = []
const sockets: Socket[] = []

const createClient = (connectionString: string) => {
  const client = new Client({ connectionString })

  clients.push(client)

  return client
}

const connectRaw = async (connectionString: string) => {
  const { hostname, port } = new URL(connectionString)
  const socket = createConnection({ host: hostname, port: Number(port) })
  let received = Buffer.alloc(0)

  sockets.push(socket)

  socket.on('data', (chunk: Buffer) => {
    received = Buffer.concat([received, chunk])
  })

  await once(socket, 'connect')

  const message = (type: string, ...body: Buffer[]) => {
    const payload = Buffer.concat(body)
    const header = Buffer.alloc(5)

    header.write(type)
    header.writeInt32BE(4 + payload.length, 1)

    return Buffer.concat([header, payload])
  }

  const text = (value: string) => Buffer.from(`${value}\0`)
  const int16 = (value: number) => Buffer.from([value >> 8, value & 0xff])

  // Resolves with the backend messages received up to the next ReadyForQuery.
  const readUntilReady = async () => {
    for (;;) {
      const messages: { type: string; body: Buffer }[] = []
      let offset = 0

      while (received.length - offset >= 5) {
        const end = offset + 1 + received.readInt32BE(offset + 1)

        if (end > received.length) {
          break
        }

        messages.push({ type: String.fromCharCode(received[offset]), body: received.subarray(offset + 5, end) })
        offset = end

        if (messages[messages.length - 1].type === 'Z') {
          received = received.subarray(offset)

          return messages
        }
      }

      await once(socket, 'data')
    }
  }

  const startup = Buffer.concat([Buffer.alloc(8), text('user'), text('postgres'), Buffer.alloc(1)])

  startup.writeInt32BE(startup.length, 0)
  startup.writeInt32BE(196608, 4)
  socket.write(startup)
  await readUntilReady()

  return {
    socket,
    readUntilReady,
    parse: (name: string, sql: string) => message('P', text(name), text(sql), int16(0)),
    bind: (statement: string) => message('B', text(''), text(statement), int16(0), int16(0), int16(0)),
    execute: () => message('E', text(''), Buffer.alloc(4)),
    sync: () => message('S'),
  }
}

afterEach(async () => {
  // `end()` resolves immediately for a client that never connected or is
  // already closed, so every registered client can be closed unconditionally.
  await Promise.all(clients.map((client) => client.end()))
  clients.length = 0

  for (const socket of sockets) {
    socket.destroy()
  }

  sockets.length = 0

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

  expect(connectionString).toMatch(/^postgres:\/\/postgres@localhost:\d+\/postgres$/)
})

test('Uses the specified port when provided', async () => {
  const port = 15432
  server = new NetlifyDB({ port })
  const connectionString = await server.start()

  expect(connectionString).toBe(`postgres://postgres@localhost:${String(port)}/postgres`)
})

test('Returns a connection string that carries a username', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  expect(new URL(connectionString).username).not.toBe('')
})

test('Accepts client connections when no username can be read from the environment', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const { PGUSER } = process.env
  const hostUser = pgDefaults.user

  // Edge Functions isolates expose neither `PGUSER` nor `USER`, so `pg` has no
  // username to put in the startup message.
  delete process.env.PGUSER
  pgDefaults.user = undefined

  const client = createClient(connectionString)

  try {
    await client.connect()

    const result = await client.query<{ value: number }>('SELECT 1 AS value')
    expect(result.rows[0].value).toBe(1)
  } finally {
    await client.end()

    pgDefaults.user = hostUser

    if (PGUSER !== undefined) {
      process.env.PGUSER = PGUSER
    }
  }
})

test('Accepts PostgreSQL client connections', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()

  const result = await client.query('SELECT 1 as value')
  expect(result.rows).toHaveLength(1)

  await client.end()
})

test('Executes basic SQL queries', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

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

  const client1 = createClient(connectionString)
  const client2 = createClient(connectionString)

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

  const client1 = createClient(connectionString1)

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

  const client2 = createClient(connectionString2)

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

  const client1 = createClient(connectionString1)

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

  const client2 = createClient(connectionString2)

  await client2.connect()

  // Table should not exist
  await expect(client2.query('SELECT * FROM temp_data')).rejects.toThrow()

  await client2.end()
})

test('Delivers LISTEN/NOTIFY across separate connections', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const listener = createClient(connectionString)
  const notifier = createClient(connectionString)

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

  const listener = createClient(connectionString)
  const notifier = createClient(connectionString)

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

  const listener1 = createClient(connectionString)
  const listener2 = createClient(connectionString)
  const notifier = createClient(connectionString)

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

  const listener = createClient(connectionString)
  const notifier = createClient(connectionString)
  const observer = createClient(connectionString)

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

  const listener = createClient(connectionString)
  const notifier = createClient(connectionString)

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

test('Resets the database by dropping all tables', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()

  await client.query(`
    CREATE TABLE reset_test (
      id SERIAL PRIMARY KEY,
      value TEXT
    )
  `)
  await client.query(`INSERT INTO reset_test (value) VALUES ('before reset')`)

  const before = await client.query('SELECT * FROM reset_test')
  expect(before.rows).toHaveLength(1)

  await server.reset()

  await expect(client.query('SELECT * FROM reset_test')).rejects.toThrow()

  await client.end()
})

test('Allows creating tables again after reset', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()

  await client.query('CREATE TABLE first_table (id SERIAL PRIMARY KEY)')
  await server.reset()

  await client.query('CREATE TABLE first_table (id SERIAL PRIMARY KEY)')
  const result = await client.query<{ value: number }>('SELECT 1 AS value')
  expect(result.rows[0].value).toBe(1)

  await client.end()
})

test('Drops custom schemas on reset', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()

  await client.query('CREATE SCHEMA custom_schema')
  await client.query('CREATE TABLE custom_schema.my_table (id SERIAL PRIMARY KEY)')

  await server.reset()

  await expect(client.query('SELECT * FROM custom_schema.my_table')).rejects.toThrow()

  await client.end()
})

test('Throws when reset is called before start', async () => {
  server = new NetlifyDB()

  await expect(server.reset()).rejects.toThrow('Database has not been started')
})

test('Stops the server cleanly', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  // Verify server is running
  const client = createClient(connectionString)

  await client.connect()
  await client.end()

  // Stop the server
  await server.stop()
  server = undefined

  // New connections should fail
  const client2 = createClient(connectionString)

  await expect(client2.connect()).rejects.toThrow()
})

test('Keeps concurrent extended-protocol queries from different clients apart', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const connected = await Promise.all([0, 1, 2].map(() => createClient(connectionString).connect()))

  /**
   * Each client runs its queries in sequence, while the clients run in
   * parallel so that their Parse/Bind/Execute/Sync pipelines interleave. The
   * SQL differs per client, so binding to another client's unnamed statement
   * would show up in the results.
   */
  const results = await Promise.all(
    connected.map(async (client, c) => {
      const rows: { v: number; c: number }[] = []

      for (let i = 0; i < 20; i++) {
        const result = await client.query<{ v: number; c: number }>(`SELECT $1::int AS v, ${String(c)} AS c`, [i])

        rows.push(result.rows[0])
      }

      return rows
    }),
  )

  expect(results).toEqual([0, 1, 2].map((c) => Array.from({ length: 20 }, (_, v) => ({ v, c }))))
})

test('Answers extended-protocol queries without delay', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()
  await client.query('SELECT $1::int AS v', [0])

  // Each parameterized query is a pipeline of five messages, answered with
  // one write per message. With Nagle's algorithm on, every query takes
  // about 40 ms; without, well under a millisecond.
  const start = performance.now()

  for (let i = 0; i < 50; i++) {
    await client.query('SELECT $1::int AS v', [i])
  }

  expect(performance.now() - start).toBeLessThan(500)
})

test('Namespaces prepared statements per client', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client1 = createClient(connectionString)
  const client2 = createClient(connectionString)

  await client1.connect()
  await client2.connect()

  const run = async (client: Client, text: string) => {
    const values: number[] = []

    for (let i = 0; i < 10; i++) {
      const result = await client.query<{ v: number }>({ name: 'q', text })

      values.push(result.rows[0].v)
    }

    return values
  }

  const [first, second] = await Promise.all([run(client1, 'SELECT 1 AS v'), run(client2, 'SELECT 2 AS v')])

  expect(first).toEqual(Array.from({ length: 10 }, () => 1))
  expect(second).toEqual(Array.from({ length: 10 }, () => 2))
})

test('Keeps a pipeline exclusive until its Sync', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const raw = await connectRaw(connectionString)
  const client = createClient(connectionString)

  await client.connect()

  raw.socket.write(raw.parse('', 'SELECT 1 AS v'))

  const other = client.query<{ v: number }>('SELECT 2 AS v')

  await new Promise((resolve) => setTimeout(resolve, 100))

  raw.socket.write(Buffer.concat([raw.bind(''), raw.execute(), raw.sync()]))

  const messages = await raw.readUntilReady()
  const dataRow = messages.find(({ type }) => type === 'D')

  // DataRow: Int16(columns) | Int32(length) | value
  expect(dataRow?.body.subarray(6).toString()).toBe('1')
  expect(messages[messages.length - 1].body.toString()).toBe('I')
  expect((await other).rows[0].v).toBe(2)
})

test('Closes the prepared statements of a client that disconnects', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client1 = createClient(connectionString)
  const client2 = createClient(connectionString)

  await client1.connect()
  await client2.connect()

  await client1.query({ name: 'cleanup', text: 'SELECT 1 AS v' })

  const statements = () => client2.query<{ name: string }>('SELECT name FROM pg_prepared_statements')

  expect((await statements()).rows.map(({ name }) => name)).toEqual([expect.stringMatching(/^\d+_cleanup$/)])

  await client1.end()
  await new Promise((resolve) => setTimeout(resolve, 100))

  expect((await statements()).rows).toEqual([])
})

test('Holds other clients back while a client is in a transaction', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client1 = createClient(connectionString)
  const client2 = createClient(connectionString)

  await client1.connect()
  await client2.connect()

  await client1.query('CREATE TABLE tx_test (id SERIAL PRIMARY KEY)')
  await client1.query('BEGIN')
  await client1.query('INSERT INTO tx_test DEFAULT VALUES')

  let countResolved = false
  const count = client2.query<{ count: string }>('SELECT count(*) FROM tx_test').then((result) => {
    countResolved = true

    return result.rows[0].count
  })

  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(countResolved).toBe(false)

  await client1.query('ROLLBACK')

  expect(await count).toBe('0')
})

test('Rolls back the open transaction of a client that disconnects', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client1 = createClient(connectionString)
  const client2 = createClient(connectionString)

  await client1.connect()
  await client2.connect()

  await client1.query('CREATE TABLE disconnect_test (id SERIAL PRIMARY KEY)')
  await client1.query('BEGIN')
  await client1.query('INSERT INTO disconnect_test DEFAULT VALUES')

  const count = client2.query<{ count: string }>('SELECT count(*) FROM disconnect_test')

  // Drop the socket without a Terminate message.
  client1.on('error', () => {})
  client1.connection.stream.destroy()

  expect((await count).rows[0].count).toBe('0')
})

test('Reports the server settings of PGlite during the handshake', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)
  const parameters = new Map<string, string>()

  client.connection.on('parameterStatus', (message: { parameterName: string; parameterValue: string }) => {
    parameters.set(message.parameterName, message.parameterValue)
  })

  await client.connect()

  const result = await client.query<{ server_version: string }>('SHOW server_version')

  expect(result.rows[0].server_version).toMatch(/^17\./)
  expect(parameters.get('server_version')).toBe(result.rows[0].server_version)
  expect(parameters.get('client_encoding')).toBe('UTF8')
  expect(parameters.get('standard_conforming_strings')).toBe('on')
})

test('Delivers a notification once to a client that notifies its own channel', async () => {
  server = new NetlifyDB()
  const connectionString = await server.start()

  const client = createClient(connectionString)

  await client.connect()

  const received: string[] = []

  client.on('notification', (msg) => {
    received.push(msg.payload ?? '')
  })

  await client.query('LISTEN self_channel')
  await client.query("NOTIFY self_channel, 'echo'")
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(received).toEqual(['echo'])
})
