import { describe, expect, test } from 'vitest'

import type { Site } from './site.js'

describe('Site types', () => {
  test('Site interface accepts all optional properties', () => {
    const site: Site = {}
    expect(site).toBeDefined()

    const siteWithProps: Site = {
      id: 'site-id',
      name: 'My Site',
      url: 'https://example.com',
    }
    expect(siteWithProps.id).toBe('site-id')
    expect(siteWithProps.name).toBe('My Site')
    expect(siteWithProps.url).toBe('https://example.com')
  })
})
