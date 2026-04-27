import type { UserData } from 'gotrue-js'

/** Clears nf_jwt and nf_refresh cookies via expiry. Use in afterEach for browser test files. */
export const clearBrowserAuthCookies = (): void => {
  document.cookie = 'nf_jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = 'nf_refresh=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

export const makeGoTrueUser = (overrides: Partial<UserData> = {}): UserData => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  aud: '',
  role: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-25T00:00:00Z',
  app_metadata: { provider: 'github' },
  user_metadata: { full_name: 'Jane Doe', avatar_url: 'https://example.com/avatar.png' },
  ...overrides,
})
