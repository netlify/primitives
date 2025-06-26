import { it, expect, describe } from 'vitest'

import { decodeWin32SafeName, encodeWin32SafeName } from './util.ts'

describe('win32 safe names', () => {
  it('encodes unsafe path parts', () => {
    const unsafe = 'hello|*<>world'
    const safe = encodeWin32SafeName(unsafe)
    expect(safe).not.toContain('|')
    expect(safe).not.toContain('.')
    expect(safe).not.toContain('*')
    expect(safe).not.toContain('<')
    expect(safe).not.toContain('>')
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
    const unsafe = 'hello|.*<>world'
    const safe = encodeWin32SafeName(unsafe)
    expect(decodeWin32SafeName(safe)).toEqual(unsafe)
  })
})
