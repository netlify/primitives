import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getDatabase, MissingDatabaseConnectionError, ownerRole, readOnlyRole } from './main.js'

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
      'The environment has not been configured to use Netlify DB. To use it manually, supply the `connectionString` option when calling `getDatabase()`.',
    )
  })

  it('returns an object with sql, pool, and connectionString using node-postgres by default', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase()

    expect(mockPgPool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner',
    })
    expect(mockWaddlerNodePostgres).toHaveBeenCalledWith({ client: expect.any(Object) })
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(mockNeonPool).not.toHaveBeenCalled()
    expect(result).toEqual({
      driver: 'server',
      sql: 'node-postgres-sql',
      pool: expect.any(Object),
      connectionString: 'postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner',
    })
  })

  it('uses node-postgres when NETLIFY_DB_DRIVER is "server"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'server'

    const result = getDatabase()

    expect(mockWaddlerNodePostgres).toHaveBeenCalled()
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner')
  })

  it('uses neon-http for sql and neon Pool for pool when NETLIFY_DB_DRIVER is "serverless"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'serverless'

    const result = getDatabase()

    expect(mockWaddlerNeonHttp).toHaveBeenCalledWith({ client: 'neon-http-client' })
    expect(mockNeonPool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner',
    })
    expect(mockWaddlerNodePostgres).not.toHaveBeenCalled()
    expect(mockPgPool).not.toHaveBeenCalled()
    expect(mockNeon).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner')
    expect(result).toEqual({
      driver: 'serverless',
      sql: 'neon-http-sql',
      pool: expect.any(Object),
      httpClient: 'neon-http-client',
      connectionString: 'postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner',
    })
  })

  it('sets neonConfig.webSocketConstructor from ws when WebSocket is not globally available', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
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
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'serverless'
    const existingWs = function ExistingWebSocket() {}
    mockNeonConfig.webSocketConstructor = existingWs

    getDatabase()

    expect(mockNeonConfig.webSocketConstructor).toBe(existingWs)
  })

  it('allows override via connectionString option', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })

    expect(mockPgPool).toHaveBeenCalledWith({
      connectionString: 'postgres://other:pass@localhost:5432/otherdb?role=netlifydb_owner',
    })
    expect(result.connectionString).toBe('postgres://other:pass@localhost:5432/otherdb?role=netlifydb_owner')
  })

  it('uses NETLIFY_DB_URL environment variable', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase()

    expect(mockPgPool).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner',
    })
    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner')
  })

  it('defaults role_type to "owner" when role is not set', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase()

    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb?role=netlifydb_owner')
  })

  it('sets role_type to "read-only" when role is "read-only"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase({ role: readOnlyRole })

    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb?role=netlifydb_readonly')
  })

  it('preserves existing query parameters when appending role_type', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb?sslmode=require'

    const result = getDatabase({ role: readOnlyRole })

    expect(result.connectionString).toContain('sslmode=require')
    expect(result.connectionString).toContain('role=netlifydb_readonly')
  })
})
