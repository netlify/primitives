import { describe, expect, expectTypeOf, test } from 'vitest'

import type { Site, SiteConfig } from './site.js'

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

  test('SiteConfig interface accepts optional timeout properties', () => {
    const config: SiteConfig = {}
    expect(config).toBeDefined()

    const configWithFunctionsTimeout: SiteConfig = {
      functionsTimeout: 60,
    }
    expect(configWithFunctionsTimeout.functionsTimeout).toBe(60)

    const configWithFunctionsConfig: SiteConfig = {
      functionsConfig: {
        timeout: 45,
      },
    }
    expect(configWithFunctionsConfig.functionsConfig?.timeout).toBe(45)

    const configWithBoth: SiteConfig = {
      functionsTimeout: 60,
      functionsConfig: {
        timeout: 45,
      },
    }
    expect(configWithBoth.functionsTimeout).toBe(60)
    expect(configWithBoth.functionsConfig?.timeout).toBe(45)
  })

  test('timeout values have correct types', () => {
    const config: SiteConfig = {
      functionsTimeout: 30,
      functionsConfig: {
        timeout: 900,
      },
    }

    expect(config.functionsTimeout).toBe(30)
    expect(config.functionsConfig?.timeout).toBe(900)
    
    expectTypeOf(config.functionsTimeout).toEqualTypeOf<number | undefined>()
    expectTypeOf(config.functionsConfig).toEqualTypeOf<{ timeout?: number } | undefined>()
    
    if (config.functionsTimeout) {
      expectTypeOf(config.functionsTimeout).toBeNumber()
    }

    if (config.functionsConfig?.timeout) {
      expectTypeOf(config.functionsConfig.timeout).toBeNumber()
    }
  })
})
