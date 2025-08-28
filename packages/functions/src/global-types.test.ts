import { describe, test, expectTypeOf } from 'vitest'
import type { NetlifyGlobal } from '@netlify/types'

// Import the main module to ensure global augmentation is loaded
import './main.js'

describe('Netlify global type declaration regression test', () => {
  test('should augment global scope with `Netlify` global', () => {
    expectTypeOf<typeof Netlify>().toEqualTypeOf<NetlifyGlobal>()
    expectTypeOf<typeof Netlify>().toHaveProperty('env')
    expectTypeOf<typeof Netlify>().toHaveProperty('context')
  })
})
