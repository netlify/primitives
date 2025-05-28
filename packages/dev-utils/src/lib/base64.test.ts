import { describe, expect, test } from 'vitest'

import { shouldBase64Encode } from './base64.js'

describe('`shouldBase64Encode` helper', () => {
  test('Returns `false` for `text/` content types', async () => {
    expect(shouldBase64Encode('text/html')).toBeFalsy()
  })
})
