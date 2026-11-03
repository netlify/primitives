import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { KeychainReadResult } from './keychain.js'

const mocks = vi.hoisted(() => {
  const state: { config: Record<string, unknown>; keychainRead: KeychainReadResult } = {
    config: {},
    keychainRead: { status: 'missing' },
  }
  return Object.assign(state, { readTokenFromKeychain: vi.fn() })
})

vi.mock('./global-config.js', () => ({
  getGlobalConfigStore: () => Promise.resolve({ get: (key: string) => mocks.config[key] }),
}))

vi.mock('./keychain.js', () => ({
  readTokenFromKeychain: mocks.readTokenFromKeychain,
}))

import {
  LEGACY_STORAGE_ENV_VAR,
  getAPIToken,
  getLegacyAPIToken,
  getLegacyConfigFilePath,
  isLegacyAuthStorageForced,
  readStoredAPIToken,
} from './api-token.js'

beforeEach(() => {
  mocks.config = {}
  mocks.keychainRead = { status: 'missing' }
  mocks.readTokenFromKeychain.mockReset().mockImplementation(() => Promise.resolve(mocks.keychainRead))
})

describe('isLegacyAuthStorageForced', () => {
  test('is true only for a non-empty value', () => {
    expect(isLegacyAuthStorageForced({})).toBe(false)
    expect(isLegacyAuthStorageForced({ [LEGACY_STORAGE_ENV_VAR]: '' })).toBe(false)
    expect(isLegacyAuthStorageForced({ [LEGACY_STORAGE_ENV_VAR]: '1' })).toBe(true)
  })
})

describe('getLegacyConfigFilePath', () => {
  test('resolves to config.json under an OS-appropriate netlify directory', () => {
    expect(getLegacyConfigFilePath()).toMatch(/[\\/]netlify[\\/](Config[\\/])?config\.json$/)
  })
})

describe('getLegacyAPIToken', () => {
  test("returns the current user's plaintext token", async () => {
    mocks.config = { userId: 'u1', 'users.u1.auth.token': 'tok-1', 'users.u2.auth.token': 'tok-2' }
    await expect(getLegacyAPIToken()).resolves.toBe('tok-1')
  })

  test('returns undefined when no user is logged in', async () => {
    mocks.config = { 'users.undefined.auth.token': 'stray' }
    await expect(getLegacyAPIToken()).resolves.toBeUndefined()
  })
})

describe('readStoredAPIToken', () => {
  test('prefers a plaintext token over the keychain without touching the keychain', async () => {
    mocks.config = { userId: 'u1', 'users.u1.auth.token': 'plain' }
    mocks.keychainRead = { status: 'found', token: 'stale-keychain' }

    await expect(readStoredAPIToken({})).resolves.toEqual({ source: 'config', token: 'plain' })
    expect(mocks.readTokenFromKeychain).not.toHaveBeenCalled()
  })

  test('reads the keychain when there is no plaintext token', async () => {
    mocks.config = { userId: 'u1' }
    mocks.keychainRead = { status: 'found', token: 'kc' }

    await expect(readStoredAPIToken({})).resolves.toEqual({ source: 'keychain', token: 'kc' })
    expect(mocks.readTokenFromKeychain).toHaveBeenCalledWith('u1')
  })

  test('reports a keychain read failure', async () => {
    const error = new Error('locked')
    mocks.config = { userId: 'u1' }
    mocks.keychainRead = { status: 'error', error }

    await expect(readStoredAPIToken({})).resolves.toEqual({ source: 'none', keychainError: error })
  })

  test('skips the keychain when legacy storage is forced', async () => {
    mocks.config = { userId: 'u1' }
    mocks.keychainRead = { status: 'found', token: 'kc' }

    await expect(readStoredAPIToken({ [LEGACY_STORAGE_ENV_VAR]: '1' })).resolves.toEqual({ source: 'none' })
    expect(mocks.readTokenFromKeychain).not.toHaveBeenCalled()
  })

  test('skips the keychain when no user is logged in', async () => {
    await expect(readStoredAPIToken({})).resolves.toEqual({ source: 'none' })
    expect(mocks.readTokenFromKeychain).not.toHaveBeenCalled()
  })
})

describe('getAPIToken', () => {
  test('returns the token from either source, or undefined', async () => {
    mocks.config = { userId: 'u1' }
    mocks.keychainRead = { status: 'found', token: 'kc' }
    await expect(getAPIToken({})).resolves.toBe('kc')

    mocks.keychainRead = { status: 'error', error: new Error('locked') }
    await expect(getAPIToken({})).resolves.toBeUndefined()
  })
})
