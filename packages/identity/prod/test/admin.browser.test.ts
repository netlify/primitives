/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetTestGoTrueClient } from '../src/environment.js'

vi.mock('gotrue-js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  default: class MockGoTrue {},
}))

beforeEach(() => {
  vi.resetModules()
  resetTestGoTrueClient()
})

afterEach(() => {
  resetTestGoTrueClient()
  vi.resetAllMocks()
})

describe('admin (browser)', () => {
  it('admin.listUsers throws AuthError in the browser', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.listUsers().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('server-only')
  })

  it('admin.getUser throws AuthError in the browser', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.getUser('550e8400-e29b-41d4-a716-446655440000').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('server-only')
  })

  it('admin.createUser throws AuthError in the browser', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin
      .createUser({ email: 'jane@example.com', password: 'password123' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('server-only')
  })

  it('admin.updateUser throws AuthError in the browser', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin
      .updateUser('550e8400-e29b-41d4-a716-446655440000', { email: 'new@example.com' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('server-only')
  })

  it('admin.deleteUser throws AuthError in the browser', async () => {
    const { admin } = await import('../src/admin.js')
    const { AuthError } = await import('../src/errors.js')

    const error = await admin.deleteUser('550e8400-e29b-41d4-a716-446655440000').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect((error as InstanceType<typeof AuthError>).message).toContain('server-only')
  })
})
