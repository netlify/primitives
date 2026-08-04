import { it, expect, describe } from 'vitest'

import { BlobsInternalError, decodeWin32SafeName, encodeWin32SafeName } from './util.ts'

describe('BlobsInternalError', () => {
  const unauthorizedWrites = [
    { method: 'put', storeName: 'site:content', displayName: 'content', status: 401 },
    { method: 'delete', storeName: 'site:content', displayName: 'content', status: 401 },
    { method: 'put', storeName: 'site:content', displayName: 'content', status: 403 },
    { method: 'put', storeName: 'legacy-store', displayName: 'legacy-store', status: 401 },
  ]

  it.each(unauthorizedWrites)(
    'explains the deploy-store restriction for a $status on $method to $storeName',
    ({ method, storeName, displayName, status }) => {
      const error = new BlobsInternalError(new Response(null, { status }), { method, storeName })

      expect(error.message).toContain(`Netlify Blobs could not write to store '${displayName}'`)
      expect(error.message).toContain(`${String(status)} status code`)
      expect(error.message).toContain(`getDeployStore`)
      expect(error.message).not.toContain('internal error')
    },
  )

  const internalErrors = [
    { method: 'put', storeName: 'deploy:6a71bdfde1a6dc000951f3a3', status: 401 },
    { method: 'get', storeName: 'site:content', status: 401 },
    { method: 'put', storeName: 'site:content', status: 500 },
    { method: 'put', storeName: undefined, status: 401 },
    { method: undefined, storeName: undefined, status: 401 },
  ]

  it.each(internalErrors)(
    'keeps the generic message for a $status on $method to $storeName',
    ({ method, storeName, status }) => {
      const error = new BlobsInternalError(new Response(null, { status }), { method, storeName })

      expect(error.message).toBe(`Netlify Blobs has generated an internal error (${String(status)} status code)`)
    },
  )

  it('keeps the generic message when no context is provided', () => {
    const error = new BlobsInternalError(new Response(null, { status: 401 }))

    expect(error.message).toBe('Netlify Blobs has generated an internal error (401 status code)')
  })

  it('includes the request ID in the write-denied message', () => {
    const response = new Response(null, { headers: { 'x-nf-request-id': 'req_123' }, status: 401 })
    const error = new BlobsInternalError(response, { method: 'put', storeName: 'site:content' })

    expect(error.message).toContain('401 status code, ID: req_123')
  })
})

describe('win32 safe names', () => {
  it('encodes unsafe path parts', () => {
    const unsafe = 'hello|*<>wo:rld'
    const safe = encodeWin32SafeName(unsafe)
    expect(safe).not.toContain('|')
    expect(safe).not.toContain('.')
    expect(safe).not.toContain('*')
    expect(safe).not.toContain('<')
    expect(safe).not.toContain('>')
    expect(safe).not.toContain(':')
  })

  it('disallows invalid names', () => {
    expect(encodeWin32SafeName('CON')).not.toBe('CON')
    expect(encodeWin32SafeName('COM1')).not.toBe('COM1')
    expect(encodeWin32SafeName('com2')).not.toBe('com2')
    expect(encodeWin32SafeName('NUL')).not.toBe('NUL')
    expect(encodeWin32SafeName('PRN')).not.toBe('PRN')
    expect(encodeWin32SafeName('LPT3')).not.toBe('LPT3')

    // no false positives
    expect(encodeWin32SafeName('annuling')).toBe('annuling')
  })

  it('replaces end dots', () => {
    const safe = encodeWin32SafeName('hello.')
    expect(safe).not.toMatch(/\.$/)
  })

  it('replaces end spaces', () => {
    const safe = encodeWin32SafeName('hehe ')
    expect(safe).not.toMatch(/\s+$/)
  })

  it('can be reversed', () => {
    const unsafe = 'hello|.*<>wo:rld'
    const safe = encodeWin32SafeName(unsafe)
    expect(decodeWin32SafeName(safe)).toEqual(unsafe)
  })
})
