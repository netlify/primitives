import { describe, expect, test } from 'vitest'

import * as bootstrap from '@netlify/edge-functions-bootstrap/version'
import { getURL } from './version.js'

describe('`getURL`', () => {
  test('Returns the URL of the bootstrap entry point', async () => {
    expect(await getURL()).toBe(await bootstrap.getURL())
  })
})
