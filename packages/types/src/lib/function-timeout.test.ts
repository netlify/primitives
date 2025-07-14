import { describe, expect, test } from 'vitest'

import type { FunctionTimeoutConfig } from './function-timeout.js'

describe('FunctionTimeoutConfig Type', () => {
  test('should allow empty configuration', () => {
    const config: FunctionTimeoutConfig = {}
    expect(config).toEqual({})
  })

  test('should allow functionsTimeout configuration', () => {
    const config: FunctionTimeoutConfig = {
      functionsTimeout: 60
    }
    expect(config.functionsTimeout).toBe(60)
  })

  test('should allow functionsConfig.timeout configuration', () => {
    const config: FunctionTimeoutConfig = {
      functionsConfig: {
        timeout: 120
      }
    }
    expect(config.functionsConfig?.timeout).toBe(120)
  })

  test('should allow both timeout configurations', () => {
    const config: FunctionTimeoutConfig = {
      functionsTimeout: 60,
      functionsConfig: {
        timeout: 120
      }
    }
    expect(config.functionsTimeout).toBe(60)
    expect(config.functionsConfig?.timeout).toBe(120)
  })
})