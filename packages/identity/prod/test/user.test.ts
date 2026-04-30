import { describe, it, expect, afterEach, vi } from 'vitest'
import { toUser, getUser, isAuthenticated, decodeJwtPayload } from '../src/user.js'
import { resetTestGoTrueClient } from '../src/environment.js'
import { makeGoTrueUser } from './fixtures.js'

/** Builds a fake JWT (header.payload.signature) from a claims object. */
const fakeJwt = (claims: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.fake-sig`
}

describe('toUser', () => {
  it('normalizes a UserData to User', () => {
    const goTrueUser = makeGoTrueUser()
    const user = toUser(goTrueUser)

    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(user.confirmedAt).toBe('2026-01-01T00:00:00Z')
    expect(user.provider).toBe('github')
    expect(user.name).toBe('Jane Doe')
    expect(user.pictureUrl).toBe('https://example.com/avatar.png')
    expect(user.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(user.updatedAt).toBe('2026-02-25T00:00:00Z')
    expect(user.userMetadata).toEqual(goTrueUser.user_metadata)
  })

  it('maps GoTrue-level fields', () => {
    const goTrueUser = makeGoTrueUser({
      aud: 'app-audience',
      role: 'editor',
      invited_at: '2026-01-15T00:00:00Z',
      confirmation_sent_at: '2026-01-01T00:00:00Z',
      recovery_sent_at: '2026-02-01T00:00:00Z',
      new_email: 'new@example.com',
      email_change_sent_at: '2026-02-20T00:00:00Z',
      last_sign_in_at: '2026-02-25T00:00:00Z',
    })
    const user = toUser(goTrueUser)
    expect(user.role).toBe('editor')
    expect(user.invitedAt).toBe('2026-01-15T00:00:00Z')
    expect(user.confirmationSentAt).toBe('2026-01-01T00:00:00Z')
    expect(user.recoverySentAt).toBe('2026-02-01T00:00:00Z')
    expect(user.pendingEmail).toBe('new@example.com')
    expect(user.emailChangeSentAt).toBe('2026-02-20T00:00:00Z')
    expect(user.lastSignInAt).toBe('2026-02-25T00:00:00Z')
  })

  it('omits GoTrue-level fields when empty or absent', () => {
    const goTrueUser = makeGoTrueUser()
    const user = toUser(goTrueUser)
    expect(user.role).toBeUndefined()
    expect(user.invitedAt).toBeUndefined()
    expect(user.confirmationSentAt).toBeUndefined()
    expect(user.recoverySentAt).toBeUndefined()
    expect(user.pendingEmail).toBeUndefined()
    expect(user.emailChangeSentAt).toBeUndefined()
    expect(user.lastSignInAt).toBeUndefined()
  })

  it('extracts roles from app_metadata', () => {
    const goTrueUser = makeGoTrueUser({
      app_metadata: { provider: 'email', roles: ['admin', 'editor'] },
    })
    const user = toUser(goTrueUser)
    expect(user.roles).toEqual(['admin', 'editor'])
  })

  it('handles missing roles', () => {
    const goTrueUser = makeGoTrueUser()
    const user = toUser(goTrueUser)
    expect(user.roles).toBeUndefined()
  })

  it('handles missing optional fields', () => {
    const goTrueUser = makeGoTrueUser({
      confirmed_at: null,
      user_metadata: {},
    })
    const user = toUser(goTrueUser)

    expect(user.confirmedAt).toBeUndefined()
    expect(user.name).toBeUndefined()
    expect(user.pictureUrl).toBeUndefined()
  })

  it('handles undefined user_metadata and app_metadata', () => {
    const goTrueUser = makeGoTrueUser({
      user_metadata: undefined as unknown as Record<string, unknown>,
      app_metadata: undefined as unknown as Record<string, unknown>,
    })
    const user = toUser(goTrueUser)

    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.provider).toBeUndefined()
    expect(user.name).toBeUndefined()
    expect(user.pictureUrl).toBeUndefined()
    expect(user.userMetadata).toEqual({})
  })
})

describe('getUser (server)', () => {
  afterEach(() => {
    delete globalThis.netlifyIdentityContext
    resetTestGoTrueClient()
    vi.restoreAllMocks()
  })

  it('returns null when no identity context exists', async () => {
    expect(await getUser()).toBeNull()
  })

  it('returns User from identity context (claims fallback)', async () => {
    // No identity URL available, so fetch can't happen; falls back to claims
    globalThis.netlifyIdentityContext = {
      user: {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
        exp: 9999999999,
        app_metadata: { provider: 'github' },
        user_metadata: { full_name: 'Jane Doe' },
      },
    }

    const user = await getUser()
    if (!user) throw new Error('expected user to not be null')
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(user.provider).toBe('github')
    expect(user.name).toBe('Jane Doe')
  })

  it('fetches full user from GoTrue when identity URL is available', async () => {
    const token = fakeJwt({ sub: '550e8400-e29b-41d4-a716-446655440000', email: 'jane@example.com' })
    globalThis.netlifyIdentityContext = {
      url: 'https://example.com/.netlify/identity',
      token,
      user: { sub: '550e8400-e29b-41d4-a716-446655440000', email: 'jane@example.com' },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'jane@example.com',
          confirmed_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-02-25T00:00:00Z',
          app_metadata: { provider: 'github', roles: ['admin'] },
          user_metadata: { full_name: 'Jane Doe', avatar_url: 'https://example.com/avatar.png' },
        }),
        { status: 200 },
      ),
    )

    const user = await getUser()
    if (!user) throw new Error('expected user to not be null')
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.confirmedAt).toBe('2026-01-01T00:00:00Z')
    expect(user.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(user.pictureUrl).toBe('https://example.com/avatar.png')
    expect(user.roles).toEqual(['admin'])
  })

  it('falls back to claims when GoTrue fetch fails', async () => {
    const token = fakeJwt({ sub: '550e8400-e29b-41d4-a716-446655440000', email: 'jane@example.com' })
    globalThis.netlifyIdentityContext = {
      url: 'https://example.com/.netlify/identity',
      token,
      user: {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
        app_metadata: { provider: 'email', roles: ['editor'] },
        user_metadata: { full_name: 'Jane Doe' },
      },
    }

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

    const user = await getUser()
    if (!user) throw new Error('expected user to not be null')
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.roles).toEqual(['editor'])
    // Falls back to claims, so no GoTrue-level fields
    expect(user.role).toBeUndefined()
    expect(user.createdAt).toBeUndefined()
    expect(user.lastSignInAt).toBeUndefined()
  })

  it('handles user with missing metadata fields', async () => {
    globalThis.netlifyIdentityContext = {
      user: {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
      },
    }

    const user = await getUser()
    if (!user) throw new Error('expected user to not be null')
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(user.email).toBe('jane@example.com')
    expect(user.provider).toBeUndefined()
    expect(user.name).toBeUndefined()
    expect(user.userMetadata).toEqual({})
  })
})

describe('getUser (server, cookie fallback)', () => {
  const savedUrl = process.env.URL

  afterEach(() => {
    if (savedUrl !== undefined) {
      process.env.URL = savedUrl
    } else {
      delete process.env.URL
    }
    delete globalThis.netlifyIdentityContext
    delete (globalThis as Record<string, unknown>).Netlify
    resetTestGoTrueClient()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('falls back to nf_jwt cookie when identityContext has no token', async () => {
    delete process.env.URL
    const claims = {
      sub: 'cookie-user-456',
      email: 'cookie@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Cookie User' },
    }
    const jwt = fakeJwt(claims)

    globalThis.Netlify = {
      context: {
        cookies: {
          get: (name: string) => (name === 'nf_jwt' ? jwt : undefined),
          set: () => {},
          delete: () => {},
        },
      },
    } as unknown as typeof globalThis.Netlify

    const user = await getUser()
    // Fail-closed: without server-validated identityContext, unverified cookies are not trusted
    expect(user).toBeNull()
  })

  it('returns null when no identityContext and no cookies', async () => {
    expect(await getUser()).toBeNull()
  })
})

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const claims = { sub: 'user-1', email: 'test@example.com' }
    const jwt = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify(claims))}.sig`

    const result = decodeJwtPayload(jwt)
    expect(result).toEqual(expect.objectContaining({ sub: 'user-1', email: 'test@example.com' }))
  })

  it('returns null for token with wrong number of segments', () => {
    expect(decodeJwtPayload('only-one-part')).toBeNull()
    expect(decodeJwtPayload('two.parts')).toBeNull()
    expect(decodeJwtPayload('a.b.c.d')).toBeNull()
  })

  it('returns null for token with invalid base64 payload', () => {
    expect(decodeJwtPayload('header.!!!invalid!!!.sig')).toBeNull()
  })

  it('returns null for token with non-JSON payload', () => {
    const notJson = btoa('this is not json')
    expect(decodeJwtPayload(`header.${notJson}.sig`)).toBeNull()
  })

  it('handles base64url-encoded payloads (- and _ characters)', () => {
    const claims = { sub: 'user-1' }
    const standard = btoa(JSON.stringify(claims))
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = `header.${urlSafe}.sig`

    const result = decodeJwtPayload(jwt)
    expect(result).toEqual(expect.objectContaining({ sub: 'user-1' }))
  })
})

describe('isAuthenticated (server)', () => {
  afterEach(() => {
    delete globalThis.netlifyIdentityContext
    resetTestGoTrueClient()
  })

  it('returns false when no session exists', async () => {
    expect(await isAuthenticated()).toBe(false)
  })

  it('returns true when user is present', async () => {
    globalThis.netlifyIdentityContext = {
      user: {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'jane@example.com',
        app_metadata: { provider: 'github' },
        user_metadata: {},
      },
    }
    expect(await isAuthenticated()).toBe(true)
  })
})
