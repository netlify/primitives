import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getDatabase, MissingDatabaseConnectionError } from './main.js'

const { mockWaddlerNodePostgres, mockWaddlerNeonHttp, mockPgPool, mockNeonPool } = vi.hoisted(() => ({
  mockWaddlerNodePostgres: vi.fn().mockReturnValue('node-postgres-sql'),
  mockWaddlerNeonHttp: vi.fn().mockReturnValue('neon-http-sql'),
  mockPgPool: vi.fn(),
  mockNeonPool: vi.fn(),
}))

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

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: 'postgres://user:pass@localhost:5432/mydb' })
    expect(mockWaddlerNodePostgres).toHaveBeenCalledWith({ client: expect.any(Object) })
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(mockNeonPool).not.toHaveBeenCalled()
    expect(result).toEqual({
      sql: 'node-postgres-sql',
      pool: expect.any(Object),
      connectionString: 'postgres://user:pass@localhost:5432/mydb',
    })
  })

  it('uses node-postgres when NETLIFY_DB_DRIVER is "server"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'server'

    const result = getDatabase()

    expect(mockWaddlerNodePostgres).toHaveBeenCalled()
    expect(mockWaddlerNeonHttp).not.toHaveBeenCalled()
    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb')
  })

  it('uses neon-http for sql and neon Pool for pool when NETLIFY_DB_DRIVER is "serverless"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'serverless'

    const result = getDatabase()

    expect(mockWaddlerNeonHttp).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/mydb')
    expect(mockNeonPool).toHaveBeenCalledWith({ connectionString: 'postgres://user:pass@localhost:5432/mydb' })
    expect(mockWaddlerNodePostgres).not.toHaveBeenCalled()
    expect(mockPgPool).not.toHaveBeenCalled()
    expect(result).toEqual({
      sql: 'neon-http-sql',
      pool: expect.any(Object),
      connectionString: 'postgres://user:pass@localhost:5432/mydb',
    })
  })

  it('allows override via connectionString option', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })
    expect(result.connectionString).toBe('postgres://other:pass@localhost:5432/otherdb')
  })

  it('uses NETLIFY_DB_URL environment variable', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDatabase()

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: 'postgres://user:pass@localhost:5432/mydb' })
    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb')
  })
})
