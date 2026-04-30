import { describe, it, expect } from 'vitest'
import { verifyRequestOrigin } from '../src/csrf.js'
import { AuthError } from '../src/errors.js'

const makeRequest = (url: string, init?: { method?: string; origin?: string }): Request => {
  const headers = new Headers()
  if (init?.origin !== undefined) {
    headers.set('origin', init.origin)
  }
  return new Request(url, { method: init?.method ?? 'POST', headers })
}

describe('verifyRequestOrigin', () => {
  describe('default (no allowedOrigins)', () => {
    it('passes when Origin matches the request URL origin', () => {
      const request = makeRequest('https://example.com/api/login', {
        origin: 'https://example.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).not.toThrow()
    })

    it('passes when Origin matches with a non-default port', () => {
      const request = makeRequest('https://example.com:8443/api/login', {
        origin: 'https://example.com:8443',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).not.toThrow()
    })

    it('throws AuthError with status 403 when Origin does not match', () => {
      const request = makeRequest('https://example.com/api/login', {
        origin: 'https://evil.com',
      })

      let caught: unknown
      try {
        verifyRequestOrigin(request)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(AuthError)
      expect((caught as AuthError).status).toBe(403)
      expect((caught as AuthError).message).toContain('https://evil.com')
    })

    it('throws when scheme differs (http vs https)', () => {
      const request = makeRequest('https://example.com/api/login', {
        origin: 'http://example.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })

    it('throws when subdomains differ', () => {
      const request = makeRequest('https://app.example.com/api/login', {
        origin: 'https://other.example.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })
  })

  describe('all methods are checked', () => {
    it('passes on GET with same-origin', () => {
      const request = makeRequest('https://example.com/api/whatever', {
        method: 'GET',
        origin: 'https://example.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).not.toThrow()
    })

    it('throws on GET with mismatching Origin', () => {
      const request = makeRequest('https://example.com/api/whatever', {
        method: 'GET',
        origin: 'https://evil.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })

    it('throws on HEAD with mismatching Origin', () => {
      const request = makeRequest('https://example.com/api/whatever', {
        method: 'HEAD',
        origin: 'https://evil.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })

    it('throws on DELETE with mismatching Origin', () => {
      const request = makeRequest('https://example.com/api/whatever', {
        method: 'DELETE',
        origin: 'https://evil.com',
      })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })
  })

  describe('missing Origin header', () => {
    it('throws AuthError with status 403 when Origin header is absent', () => {
      const request = makeRequest('https://example.com/api/login')

      let caught: unknown
      try {
        verifyRequestOrigin(request)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(AuthError)
      expect((caught as AuthError).status).toBe(403)
      expect((caught as AuthError).message).toContain('missing Origin header')
    })

    it('throws when Origin header is empty string', () => {
      const request = makeRequest('https://example.com/api/login', { origin: '' })
      expect(() => {
        verifyRequestOrigin(request)
      }).toThrow(AuthError)
    })
  })

  describe('allowedOrigins override', () => {
    it('accepts an Origin listed in allowedOrigins', () => {
      const request = makeRequest('https://app.example.com/api/login', {
        origin: 'https://www.example.com',
      })
      expect(() => {
        verifyRequestOrigin(request, {
          allowedOrigins: ['https://www.example.com', 'https://app.example.com'],
        })
      }).not.toThrow()
    })

    it('rejects the request URL origin when allowedOrigins is provided and does not include it', () => {
      const request = makeRequest('https://app.example.com/api/login', {
        origin: 'https://app.example.com',
      })
      expect(() => {
        verifyRequestOrigin(request, { allowedOrigins: ['https://www.example.com'] })
      }).toThrow(AuthError)
    })

    it('rejects every Origin when allowedOrigins is an empty array', () => {
      const request = makeRequest('https://example.com/api/login', {
        origin: 'https://example.com',
      })
      expect(() => {
        verifyRequestOrigin(request, { allowedOrigins: [] })
      }).toThrow(AuthError)
    })

    it('still throws on missing Origin when allowedOrigins is set', () => {
      const request = makeRequest('https://example.com/api/login')
      expect(() => {
        verifyRequestOrigin(request, { allowedOrigins: ['https://example.com'] })
      }).toThrow(AuthError)
    })
  })
})
