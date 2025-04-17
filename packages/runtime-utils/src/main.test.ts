import { describe, expect, test } from 'vitest'

import { base64Decode, base64Encode } from './main.js'

describe('Base 64', () => {
  test('Encodes and decodes', async () => {
    expect(base64Decode(base64Encode('Hello'))).toBe('Hello')
  })
})
