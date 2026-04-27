import { describe, it, expect } from 'vitest'
import { AuthError, MissingIdentityError } from '../src/main.js'

describe('AuthError', () => {
  it('has correct name and status', () => {
    const err = new AuthError('fail', 401)
    expect(err.name).toBe('AuthError')
    expect(err.message).toBe('fail')
    expect(err.status).toBe(401)
    expect(err).toBeInstanceOf(Error)
  })

  it('works without status', () => {
    const err = new AuthError('oops')
    expect(err.status).toBeUndefined()
  })
})

describe('MissingIdentityError', () => {
  it('has correct name and default message', () => {
    const err = new MissingIdentityError()
    expect(err.name).toBe('MissingIdentityError')
    expect(err.message).toBe('Netlify Identity is not available.')
  })
})
