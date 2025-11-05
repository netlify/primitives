import { describe, expect, test } from 'vitest'

import { SYNCHRONOUS_FUNCTION_TIMEOUT, BACKGROUND_FUNCTION_TIMEOUT } from '@netlify/functions'
import { FunctionsRegistry } from './registry.js'

describe('FunctionsRegistry timeout configuration', () => {
  test('uses default timeouts when no config or override provided', () => {
    const registry = new FunctionsRegistry({
      config: {},
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses functions_timeout from siteInfo for sync functions only', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: {
          functions_timeout: 60,
        },
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 60,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses functions_config.timeout from siteInfo for sync functions only', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: {
          functions_config: {
            timeout: 45,
          },
        },
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 45,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('prefers functions_timeout over functions_config.timeout for sync functions', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: {
          functions_timeout: 60,
          functions_config: {
            timeout: 45,
          },
        },
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 60,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses override timeouts when provided', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: {
          functions_timeout: 60,
        },
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
      timeouts: {
        syncFunctions: 120,
        backgroundFunctions: 1800,
      },
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 120,
      backgroundFunctions: 1800,
    })
  })

  test('allows partial override of timeouts', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: {
          functions_timeout: 60,
        },
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
      timeouts: {
        syncFunctions: 120,
      },
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 120,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('falls back to defaults when siteInfo is undefined', () => {
    const registry = new FunctionsRegistry({
      config: {
        siteInfo: undefined,
      },
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('falls back to defaults when config is empty object', () => {
    const registry = new FunctionsRegistry({
      config: {},
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })
})
