import process from 'node:process'

import { describe, expect, test } from 'vitest'

import netlify from './main.js'

describe('Plugin constructor', () => {
  test('Is a no-op when running in the Netlify CLI', () => {
    process.env.NETLIFY_DEV = 'true'

    expect(netlify()).toEqual([])

    delete process.env.NETLIFY_DEV
  })
})
