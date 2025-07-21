import { describe, expect, test } from 'vitest'

import { BACKGROUND_FUNCTION_TIMEOUT, getFunctionTimeout, SYNCHRONOUS_FUNCTION_TIMEOUT } from './consts.js'

describe('Function timeout constants', () => {
  test('exports correct timeout values', () => {
    expect(SYNCHRONOUS_FUNCTION_TIMEOUT).toBe(30)
    expect(BACKGROUND_FUNCTION_TIMEOUT).toBe(900)
  })
})

describe('getFunctionTimeout', () => {
  test('returns default timeout for synchronous functions when no site config', () => {
    const result = getFunctionTimeout({})
    expect(result).toBe(SYNCHRONOUS_FUNCTION_TIMEOUT)
  })

  test('returns default timeout for background functions when no site config', () => {
    const result = getFunctionTimeout({}, true)
    expect(result).toBe(BACKGROUND_FUNCTION_TIMEOUT)
  })

  test('respects functionsTimeout from site config for synchronous functions', () => {
    const siteConfig = { functionsTimeout: 60 }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(60)
  })

  test('respects functionsTimeout from site config for background functions', () => {
    const siteConfig = { functionsTimeout: 1800 }
    const result = getFunctionTimeout(siteConfig, true)
    expect(result).toBe(1800)
  })

  test('respects functionsConfig.timeout from site config for synchronous functions', () => {
    const siteConfig = { functionsConfig: { timeout: 45 } }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(45)
  })

  test('respects functionsConfig.timeout from site config for background functions', () => {
    const siteConfig = { functionsConfig: { timeout: 1200 } }
    const result = getFunctionTimeout(siteConfig, true)
    expect(result).toBe(1200)
  })

  test('prioritizes functionsTimeout over functionsConfig.timeout', () => {
    const siteConfig = {
      functionsTimeout: 60,
      functionsConfig: { timeout: 45 },
    }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(60)
  })

  test('handles undefined functionsConfig', () => {
    const siteConfig = { functionsConfig: undefined }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(SYNCHRONOUS_FUNCTION_TIMEOUT)
  })

  test('handles empty functionsConfig object', () => {
    const siteConfig = { functionsConfig: {} }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(SYNCHRONOUS_FUNCTION_TIMEOUT)
  })

  test('handles undefined timeout in functionsConfig', () => {
    const siteConfig = { functionsConfig: { timeout: undefined } }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(SYNCHRONOUS_FUNCTION_TIMEOUT)
  })

  test('handles zero timeout values', () => {
    const siteConfig = { functionsTimeout: 0 }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(0)
  })
})
