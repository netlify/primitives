import { describe, expect, test } from 'vitest'

import type { FunctionTimeoutConfig } from '@netlify/types'

import { SYNCHRONOUS_FUNCTION_TIMEOUT, BACKGROUND_FUNCTION_TIMEOUT, getFunctionTimeout } from './function-timeout.js'

describe('Function Timeout Configuration', () => {
  test('should export correct default timeout constants', () => {
    expect(SYNCHRONOUS_FUNCTION_TIMEOUT).toBe(30)
    expect(BACKGROUND_FUNCTION_TIMEOUT).toBe(900)
  })

  test('should return default timeout for sync functions when no site config provided', () => {
    const siteConfig: FunctionTimeoutConfig = {}
    const timeout = getFunctionTimeout(siteConfig, false)
    expect(timeout).toBe(30)
  })

  test('should return default timeout for background functions when no site config provided', () => {
    const siteConfig: FunctionTimeoutConfig = {}
    const timeout = getFunctionTimeout(siteConfig, true)
    expect(timeout).toBe(900)
  })

  test('should respect functionsTimeout from site config', () => {
    const siteConfig: FunctionTimeoutConfig = {
      functionsTimeout: 60
    }
    
    // Should use site timeout for both sync and background functions
    expect(getFunctionTimeout(siteConfig, false)).toBe(60)
    expect(getFunctionTimeout(siteConfig, true)).toBe(60)
  })

  test('should respect functionsConfig.timeout from site config', () => {
    const siteConfig: FunctionTimeoutConfig = {
      functionsConfig: {
        timeout: 120
      }
    }
    
    // Should use site timeout for both sync and background functions
    expect(getFunctionTimeout(siteConfig, false)).toBe(120)
    expect(getFunctionTimeout(siteConfig, true)).toBe(120)
  })

  test('should prioritize functionsTimeout over functionsConfig.timeout', () => {
    const siteConfig: FunctionTimeoutConfig = {
      functionsTimeout: 60,
      functionsConfig: {
        timeout: 120
      }
    }
    
    // Should use functionsTimeout as it has higher priority
    expect(getFunctionTimeout(siteConfig, false)).toBe(60)
    expect(getFunctionTimeout(siteConfig, true)).toBe(60)
  })

  test('should default to sync timeout when isBackground is not specified', () => {
    const siteConfig: FunctionTimeoutConfig = {}
    const timeout = getFunctionTimeout(siteConfig)
    expect(timeout).toBe(30)
  })
})