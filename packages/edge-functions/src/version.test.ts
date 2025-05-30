import { describe, expect, test } from 'vitest'

import packageJSON from '../package.json' with { type: 'json' }
import { getURL } from './version.js'

describe('`getURL`', () => {
  test('Returns the URL of the bootstrap entry point', async () => {
    const { version } = packageJSON
    const branch = `v${version.split('.').join('-')}`

    expect(await getURL()).toBe(`https://${branch}--edge.netlify.com/bootstrap/index-combined.ts`)
  })
})
