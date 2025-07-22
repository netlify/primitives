import { describe, expect, test } from 'vitest'

import { BACKGROUND_FUNCTION_TIMEOUT, SYNCHRONOUS_FUNCTION_TIMEOUT } from './consts.js'

describe('Function timeout constants', () => {
  test('exports correct timeout values', () => {
    expect(SYNCHRONOUS_FUNCTION_TIMEOUT).toBe(30)
    expect(BACKGROUND_FUNCTION_TIMEOUT).toBe(900)
  })
})
