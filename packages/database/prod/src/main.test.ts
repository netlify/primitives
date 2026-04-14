import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getConnectionString, getDatabase, MissingDatabaseConnectionError } from './main.js'

const { mockWaddlerNodePostgres, mockWaddlerNeonHttp, mockPgPool, mockNeonPool, mockNeon, mockNeonConfig } = vi.hoisted(
  () => ({
    mockWaddlerNodePostgres: vi.fn().mockReturnValue('node-postgres-sql'),
    mockWaddlerNeonHttp: vi.fn().mockReturnValue('neon-http-sql'),
    mockPgPool: vi.fn(),
    mockNeonPool: vi.fn(),
    mockNeon: vi.fn().mockReturnValue('neon-http-client'),
    mockNeonConfig: {} as Record<string, unknown>,
  }),
)

vi.mock('waddler/node-postgres', () => ({
  waddler: mockWaddlerNodePostgres,
}))

vi.mock('waddler/neon-http', () => ({
  waddler: mockWaddlerNeonHttp,
}))

vi.mock('pg', () => ({
  default: { Pool: mockPgPool },
}))

vi.mock('@neondatabase/serverless', () => ({
  Pool: mockNeonPool,
  neon: mockNeon,
  neonConfig: mockNeonConfig,
}))

vi.mock('ws', () => ({
  default: function MockWebSocket() {},
}))

const CONNECTION_STRING = 'postgres://user:pass@localhost:5432/mydb'
const OTHER_CONNECTION_STRING = 'postgres://other:pass@localhost:5432/otherdb'

describe('getDatabase', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NETLIFY_DB_URL
    delete process.env.NETLIFY_DB_DRIVER
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('throws MissingDatabaseConnectionError when no connection string is available', () => {
    expect(() => getDatabase()).toThrow(MissingDatabaseConnectionError)
    expect(() => getDatabase()).toThrow(
      'The environment has not been configured to use Netlify Database. To use it manually, supply the `connectionString` option when calling `getDatabase()`.',
    )
  })

  it('returns an object with sql, pool, and connectionString using node-postgres by default', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING

    const result = getDatabase()

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: CONNECTION_STRING })
    expect(mockWaddlerNodePostgres).toHaveBeenCalledWith({ client: expect.any(Object) })
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(mockNeonPool).not.toHaveBeenCalled()
    expect(result).toEqual({
      driver: 'server',
      sql: 'node-postgres-sql',
      pool: expect.any(Object),
      connectionString: CONNECTION_STRING,
    })
  })

  it('uses node-postgres when NETLIFY_DB_DRIVER is "server"', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING
    process.env.NETLIFY_DB_DRIVER = 'server'

    const result = getDatabase()

    expect(mockWaddlerNodePostgres).toHaveBeenCalled()
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(result.connectionString).toBe(CONNECTION_STRING)
  })

  it('uses neon-http for sql and neon Pool for pool when NETLIFY_DB_DRIVER is "serverless"', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING
    process.env.NETLIFY_DB_DRIVER = 'serverless'

    const result = getDatabase()

    expect(mockWaddlerNeonHttp).toHaveBeenCalledWith({ client: 'neon-http-client' })
    expect(mockNeonPool).toHaveBeenCalledWith({ connectionString: CONNECTION_STRING })
    expect(mockWaddlerNodePostgres).not.toHaveBeenCalled()
    expect(mockPgPool).not.toHaveBeenCalled()
    expect(mockNeon).toHaveBeenCalledWith(CONNECTION_STRING)
    expect(result).toEqual({
      driver: 'serverless',
      sql: 'neon-http-sql',
      pool: expect.any(Object),
      httpClient: 'neon-http-client',
      connectionString: CONNECTION_STRING,
    })
  })

  it('sets neonConfig.webSocketConstructor from ws when WebSocket is not globally available', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING
    process.env.NETLIFY_DB_DRIVER = 'serverless'
    delete mockNeonConfig.webSocketConstructor

    const originalWebSocket = globalThis.WebSocket
    // @ts-expect-error — removing global to simulate older Node
    delete globalThis.WebSocket

    try {
      getDatabase()
      expect(mockNeonConfig.webSocketConstructor).toBeDefined()
    } finally {
      globalThis.WebSocket = originalWebSocket
    }
  })

  it('does not override neonConfig.webSocketConstructor if already set', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING
    process.env.NETLIFY_DB_DRIVER = 'serverless'
    const existingWs = function ExistingWebSocket() {}
    mockNeonConfig.webSocketConstructor = existingWs

    getDatabase()

    expect(mockNeonConfig.webSocketConstructor).toBe(existingWs)
  })

  it('allows override via connectionString option', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING

    const result = getDatabase({ connectionString: OTHER_CONNECTION_STRING })

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: OTHER_CONNECTION_STRING })
    expect(result.connectionString).toBe(OTHER_CONNECTION_STRING)
  })

  it('uses NETLIFY_DB_URL environment variable', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING

    const result = getDatabase()

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: CONNECTION_STRING })
    expect(result.connectionString).toBe(CONNECTION_STRING)
  })
})

describe('getConnectionString', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NETLIFY_DB_URL
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns the connection string from NETLIFY_DB_URL', () => {
    process.env.NETLIFY_DB_URL = CONNECTION_STRING

    expect(getConnectionString()).toBe(CONNECTION_STRING)
  })

  it('throws MissingDatabaseConnectionError when NETLIFY_DB_URL is not set', () => {
    expect(() => getConnectionString()).toThrow(MissingDatabaseConnectionError)
  })
})
