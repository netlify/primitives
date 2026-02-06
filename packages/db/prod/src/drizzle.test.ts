import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getDrizzleClient, MissingDatabaseConnectionError } from './drizzle.js'

const { mockNeon, mockPgPool, mockNeonPool } = vi.hoisted(() => ({
  mockNeon: vi.fn().mockReturnValue('neon-http-client'),
  mockPgPool: vi.fn(),
  mockNeonPool: vi.fn(),
}))

vi.mock('@neondatabase/serverless', () => ({
  neon: mockNeon,
  Pool: mockNeonPool,
}))

vi.mock('pg', () => ({
  default: { Pool: mockPgPool },
}))

describe('getDrizzleClient', () => {
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
    expect(() => getDrizzleClient()).toThrow(MissingDatabaseConnectionError)
  })

  it('returns { driver: "server", pool: pg.Pool } by default', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDrizzleClient()

    expect(result.driver).toBe('server')
    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: 'postgres://user:pass@localhost:5432/mydb' })
    expect(mockNeon).not.toHaveBeenCalled()
    expect(mockNeonPool).not.toHaveBeenCalled()
    expect(result.connectionString).toBe('postgres://user:pass@localhost:5432/mydb')
  })

  it('returns { driver: "server" } when NETLIFY_DB_DRIVER is "server"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'server'

    const result = getDrizzleClient()

    expect(result.driver).toBe('server')
    expect(mockPgPool).toHaveBeenCalled()
    expect(mockNeon).not.toHaveBeenCalled()
  })

  it('returns { driver: "serverless", httpClient, pool: NeonPool } when NETLIFY_DB_DRIVER is "serverless"', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'
    process.env.NETLIFY_DB_DRIVER = 'serverless'

    const result = getDrizzleClient()

    expect(result.driver).toBe('serverless')
    expect(mockNeon).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/mydb')
    expect(mockNeonPool).toHaveBeenCalledWith({ connectionString: 'postgres://user:pass@localhost:5432/mydb' })
    expect(mockPgPool).not.toHaveBeenCalled()

    if (result.driver === 'serverless') {
      expect(result.httpClient).toBe('neon-http-client')
      expect(result.pool).toBeInstanceOf(Object)
    }
  })

  it('respects connectionString option override', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const result = getDrizzleClient({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })

    expect(mockPgPool).toHaveBeenCalledWith({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })
    expect(result.connectionString).toBe('postgres://other:pass@localhost:5432/otherdb')
  })

  it('includes connectionString in all return values', () => {
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    const serverResult = getDrizzleClient()
    expect(serverResult.connectionString).toBe('postgres://user:pass@localhost:5432/mydb')

    process.env.NETLIFY_DB_DRIVER = 'serverless'
    const serverlessResult = getDrizzleClient()
    expect(serverlessResult.connectionString).toBe('postgres://user:pass@localhost:5432/mydb')
  })
})
