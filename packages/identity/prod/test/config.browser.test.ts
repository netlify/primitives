/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost" }
 */
import { describe, it, expect, afterEach } from 'vitest'
import { getIdentityConfig } from '../src/main.js'
import { resetTestGoTrueClient } from '../src/environment.js'

describe('getIdentityConfig (browser)', () => {
  afterEach(() => {
    resetTestGoTrueClient()
  })

  it('returns config with URL from window origin', () => {
    const config = getIdentityConfig()
    expect(config).not.toBeNull()
    expect(config!.url).toContain('/.netlify/identity')
    expect(config!.token).toBeUndefined()
  })
})
