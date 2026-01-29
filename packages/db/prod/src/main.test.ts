import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getDatabase, MissingDatabaseConnectionError } from './main.js'

vi.mock('postgres', () => {
  const mockSql = vi.fn()
  return { default: mockSql }
})

describe('getDatabase', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NETLIFY_DB_URL
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

  it('uses NETLIFY_DB_URL environment variable', async () => {
    const postgres = (await import('postgres')).default as unknown as ReturnType<typeof vi.fn>
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    getDatabase()

    expect(postgres).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/mydb', expect.objectContaining({
      onnotice: expect.any(Function),
    }))
  })

  it('allows override via connectionString option', async () => {
    const postgres = (await import('postgres')).default as unknown as ReturnType<typeof vi.fn>
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    getDatabase({ connectionString: 'postgres://other:pass@localhost:5432/otherdb' })

    expect(postgres).toHaveBeenCalledWith('postgres://other:pass@localhost:5432/otherdb', expect.objectContaining({
      onnotice: expect.any(Function),
    }))
  })

  it('uses connectionString option when env var is not set', async () => {
    const postgres = (await import('postgres')).default as unknown as ReturnType<typeof vi.fn>

    getDatabase({ connectionString: 'postgres://custom:pass@localhost:5432/customdb' })

    expect(postgres).toHaveBeenCalledWith('postgres://custom:pass@localhost:5432/customdb', expect.objectContaining({
      onnotice: expect.any(Function),
    }))
  })

  it('suppresses notices by default', async () => {
    const postgres = (await import('postgres')).default as unknown as ReturnType<typeof vi.fn>
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    getDatabase()

    const { onnotice } = postgres.mock.calls[0][1]
    expect(onnotice).not.toBe(console.log)
    expect(typeof onnotice).toBe('function')
  })

  it('logs notices when debug is enabled', async () => {
    const postgres = (await import('postgres')).default as unknown as ReturnType<typeof vi.fn>
    process.env.NETLIFY_DB_URL = 'postgres://user:pass@localhost:5432/mydb'

    getDatabase({ debug: true })

    const { onnotice } = postgres.mock.calls[0][1]
    expect(onnotice).toBe(console.log)
  })
})
