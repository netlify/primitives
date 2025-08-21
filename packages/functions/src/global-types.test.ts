import { describe, test, expectTypeOf } from 'vitest'
import type { NetlifyGlobal } from '@netlify/types'

// Import the main module to ensure global augmentation is loaded
import './main.js'

describe('Netlify global type declaration regression test', () => {
  test('should provide correct TypeScript global augmentation for Netlify', () => {
    // These lines will cause TypeScript compilation errors if Netlify global is not declared
    // This is the actual regression test - the typeof expressions will fail to compile
    expectTypeOf<typeof Netlify>().toEqualTypeOf<NetlifyGlobal>()
    expectTypeOf<typeof Netlify>().toHaveProperty('env')
    expectTypeOf<typeof Netlify>().toHaveProperty('context')
  })
})