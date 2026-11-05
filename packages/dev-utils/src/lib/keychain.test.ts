import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  entries: new Map<string, string>(),
  failing: false,
  hanging: false,
}))

vi.mock('@napi-rs/keyring', () => ({
  AsyncEntry: class {
    readonly key: string
    constructor(service: string, account: string) {
      this.key = `${service}/${account}`
    }
    async #guard() {
      if (fake.hanging) await new Promise(() => {})
      if (fake.failing) throw new Error('Platform failure: keychain unavailable')
    }
    async setPassword(value: string) {
      await this.#guard()
      fake.entries.set(this.key, value)
    }
    async getPassword() {
      await this.#guard()
      return fake.entries.get(this.key) ?? null
    }
    async deletePassword() {
      await this.#guard()
      return fake.entries.delete(this.key)
    }
  },
}))

import {
  deleteTokenFromKeychain,
  getTokenFromKeychain,
  readTokenFromKeychain,
  storeTokenInKeychain,
} from './keychain.js'

beforeEach(() => {
  fake.entries.clear()
  fake.failing = false
  fake.hanging = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('keychain helpers', () => {
  test('round-trips a token via store / get / delete', async () => {
    await expect(storeTokenInKeychain('acct', 'tok-abc')).resolves.toEqual({ status: 'stored' })
    await expect(getTokenFromKeychain('acct')).resolves.toBe('tok-abc')
    await expect(deleteTokenFromKeychain('acct')).resolves.toEqual({ status: 'deleted' })
    await expect(getTokenFromKeychain('acct')).resolves.toBeNull()
    await expect(deleteTokenFromKeychain('acct')).resolves.toEqual({ status: 'missing' })
  })

  test('stores entries under the netlify-cli service so every consumer shares them', async () => {
    await storeTokenInKeychain('acct', 'tok')
    expect([...fake.entries.keys()]).toEqual(['netlify-cli/acct'])
  })

  test('isolates entries by account', async () => {
    await storeTokenInKeychain('a', 'tok-a')
    await storeTokenInKeychain('b', 'tok-b')
    await expect(getTokenFromKeychain('a')).resolves.toBe('tok-a')
    await expect(getTokenFromKeychain('b')).resolves.toBe('tok-b')
  })

  test('readTokenFromKeychain distinguishes found, missing and unreadable entries', async () => {
    await storeTokenInKeychain('acct', 'tok')
    await expect(readTokenFromKeychain('acct')).resolves.toEqual({ status: 'found', token: 'tok' })
    await expect(readTokenFromKeychain('other')).resolves.toEqual({ status: 'missing' })

    fake.failing = true
    const result = await readTokenFromKeychain('acct')
    expect(result.status === 'error' && result.error.message).toBe('Platform failure: keychain unavailable')
  })

  test('reports keychain errors without throwing', async () => {
    fake.failing = true
    const failure = { status: 'error', error: new Error('Platform failure: keychain unavailable') }
    await expect(storeTokenInKeychain('acct', 'tok')).resolves.toEqual(failure)
    await expect(getTokenFromKeychain('acct')).resolves.toBeNull()
    await expect(deleteTokenFromKeychain('acct')).resolves.toEqual(failure)
  })

  test('gives up after 30s when the keychain never responds', async () => {
    vi.useFakeTimers()
    fake.hanging = true

    const pending = readTokenFromKeychain('acct')
    await vi.advanceTimersByTimeAsync(30_000)
    const result = await pending

    expect(result.status === 'error' && result.error.message).toMatch(
      /^Timed out after 30s waiting for the OS keychain/,
    )
  })

  test('reports errors without throwing when the native module cannot load', async () => {
    vi.resetModules()
    vi.doMock('@napi-rs/keyring', () => {
      throw new Error('no prebuilt binary for this platform')
    })
    try {
      const keychain = await import('./keychain.js')
      await expect(keychain.storeTokenInKeychain('acct', 'tok')).resolves.toMatchObject({ status: 'error' })
      await expect(keychain.getTokenFromKeychain('acct')).resolves.toBeNull()
      await expect(keychain.readTokenFromKeychain('acct')).resolves.toMatchObject({ status: 'error' })
      await expect(keychain.deleteTokenFromKeychain('acct')).resolves.toMatchObject({ status: 'error' })
    } finally {
      vi.doUnmock('@napi-rs/keyring')
    }
  })
})
