import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser } from './fixtures.js'

const IDENTITY_URL = 'https://example.netlify.app/.netlify/identity'
const OPERATOR_TOKEN = 'test-operator-token'

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()

  globalThis.netlifyIdentityContext = {
    url: IDENTITY_URL,
    token: OPERATOR_TOKEN,
  }
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  delete globalThis.netlifyIdentityContext
})

describe('admin.listUsers (server)', () => {
  it('GETs /admin/users with operator token and returns User[]', async () => {
    const users = [
      makeGoTrueUser(),
      makeGoTrueUser({ id: '661e8400-e29b-41d4-a716-446655440001', email: 'bob@example.com' }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users }),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.listUsers()

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/admin/users`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${OPERATOR_TOKEN}`,
          'Content-Type': 'application/json',
        }),
      }),
    )

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result[1].id).toBe('661e8400-e29b-41d4-a716-446655440001')
  })

  it('appends pagination query params when provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      }),
    )

    const { admin } = await import('../src/admin.js')
    await admin.listUsers({ page: 2, perPage: 10 })

    expect(fetch).toHaveBeenCalledWith(`${IDENTITY_URL}/admin/users?page=2&per_page=10`, expect.any(Object))
  })

  it('throws AuthError on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ msg: 'Forbidden' }),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.listUsers().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toBe('Forbidden')
    expect((error as InstanceType<typeof AuthError>).status).toBe(403)
  })
})

describe('admin.getUser (server)', () => {
  it('GETs /admin/users/:id and returns User', async () => {
    const userData = makeGoTrueUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.getUser('550e8400-e29b-41d4-a716-446655440000')

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/admin/users/550e8400-e29b-41d4-a716-446655440000`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${OPERATOR_TOKEN}` }),
      }),
    )
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.email).toBe('jane@example.com')
  })

  it('throws AuthError on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ msg: 'User not found' }),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('00000000-0000-0000-0000-000000000000').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).status).toBe(404)
  })
})

describe('admin.createUser (server)', () => {
  it('POSTs to /admin/users with JSON body and returns User', async () => {
    const userData = makeGoTrueUser()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.createUser({
      email: 'jane@example.com',
      password: 'password123',
      data: { role: 'editor', user_metadata: { full_name: 'Jane Doe' } },
    })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body).toEqual({
      email: 'jane@example.com',
      password: 'password123',
      role: 'editor',
      user_metadata: { full_name: 'Jane Doe' },
      confirm: true,
    })

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('works without optional data parameter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    await admin.createUser({ email: 'jane@example.com', password: 'password123' })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body).toEqual({
      email: 'jane@example.com',
      password: 'password123',
      confirm: true,
    })
  })

  it('does not allow data to override email, password, or confirm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    await admin.createUser({
      email: 'jane@example.com',
      password: 'password123',
      data: { email: 'attacker@evil.com', password: 'hacked', confirm: false },
    })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body.email).toBe('jane@example.com')
    expect(body.password).toBe('password123')
    expect(body.confirm).toBe(true)
  })

  it('silently ignores unrecognized keys in data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    await admin.createUser({
      email: 'jane@example.com',
      password: 'password123',
      data: { full_name: 'Jane Doe', arbitrary_field: 'ignored' },
    })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body).toEqual({
      email: 'jane@example.com',
      password: 'password123',
      confirm: true,
    })
  })

  it('forwards all allowed GoTrue fields from data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    await admin.createUser({
      email: 'jane@example.com',
      password: 'password123',
      data: {
        role: 'editor',
        app_metadata: { plan: 'pro' },
        user_metadata: { full_name: 'Jane Doe' },
      },
    })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body).toEqual({
      email: 'jane@example.com',
      password: 'password123',
      confirm: true,
      role: 'editor',
      app_metadata: { plan: 'pro' },
      user_metadata: { full_name: 'Jane Doe' },
    })
  })
})

describe('admin.updateUser (server)', () => {
  it('PUTs to /admin/users/:id with attributes and returns User', async () => {
    const userData = makeGoTrueUser({ email: 'updated@example.com' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.updateUser('550e8400-e29b-41d4-a716-446655440000', { email: 'updated@example.com' })

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/admin/users/550e8400-e29b-41d4-a716-446655440000`,
      expect.objectContaining({ method: 'PUT' }),
    )

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body).toEqual({ email: 'updated@example.com' })

    expect(result.email).toBe('updated@example.com')
  })
})

describe('admin.deleteUser (server)', () => {
  it('DELETEs /admin/users/:id and returns void', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.deleteUser('550e8400-e29b-41d4-a716-446655440000')

    expect(fetch).toHaveBeenCalledWith(
      `${IDENTITY_URL}/admin/users/550e8400-e29b-41d4-a716-446655440000`,
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(result).toBeUndefined()
  })

  it('throws AuthError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ msg: 'Internal error' }),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.deleteUser('550e8400-e29b-41d4-a716-446655440000').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).status).toBe(500)
  })
})

describe('admin error handling (server)', () => {
  it('throws AuthError when operator token is missing', async () => {
    globalThis.netlifyIdentityContext = { url: IDENTITY_URL }

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.listUsers().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('operator token')
  })

  it('throws AuthError when identity URL is missing', async () => {
    delete globalThis.netlifyIdentityContext

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('550e8400-e29b-41d4-a716-446655440000').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('Identity endpoint URL')
  })

  it('throws AuthError when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.listUsers().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toBe('Network error')
  })

  it('uses fallback message when error response has no msg field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
      }),
    )

    const { admin } = await import('../src/admin.js')

    const error = (await admin.listUsers().catch((e: unknown) => e)) as Error
    expect(error.message).toBe('Admin request failed (502)')
  })
})

describe('userId validation (sanitizeUserId)', () => {
  it('accepts a valid lowercase UUID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.getUser('550e8400-e29b-41d4-a716-446655440000')

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('accepts a valid uppercase UUID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeGoTrueUser()),
      }),
    )

    const { admin } = await import('../src/admin.js')
    const result = await admin.getUser('550E8400-E29B-41D4-A716-446655440000')

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('rejects path traversal strings', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('../../settings').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('not a valid UUID')
  })

  it('rejects an empty string', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('not a valid UUID')
  })

  it('rejects a UUID with extra characters appended', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('550e8400-e29b-41d4-a716-446655440000-extra').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
  })

  it('rejects a non-hex string in UUID format', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
  })
})
