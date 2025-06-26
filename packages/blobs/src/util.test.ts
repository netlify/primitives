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
