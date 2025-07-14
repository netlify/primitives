import { describe, expect, test } from 'vitest'
import {
  DEFAULT_TIMEOUTS,
  SYNCHRONOUS_FUNCTION_TIMEOUT,
  BACKGROUND_FUNCTION_TIMEOUT,
  DEFAULT_DEPLOY_TIMEOUT,
  FRAMEWORK_PORT_TIMEOUT_MS,
  FRAMEWORK_PORT_WARN_TIMEOUT_MS,
  AGENT_PORT_TIMEOUT,
  REQUEST_TIMEOUT,
  getFunctionTimeout,
  getDeployTimeout,
  createTimeoutConfig,
  createTunnelTimeoutConfig,
  secondsToMs,
  msToSeconds,
} from './timeout.js'

describe('timeout constants', () => {
  test('should export correct default timeout values', () => {
    expect(DEFAULT_TIMEOUTS).toEqual({
      functionSync: 30,
      functionBackground: 900,
      deploy: 1_200_000,
      frameworkServer: 10 * 60 * 1000,
      frameworkServerWarn: 5 * 1000,
      httpAgent: 50,
      geoLocation: 10000,
    })
  })

  test('should export individual timeout constants', () => {
    expect(SYNCHRONOUS_FUNCTION_TIMEOUT).toBe(30)
    expect(BACKGROUND_FUNCTION_TIMEOUT).toBe(900)
    expect(DEFAULT_DEPLOY_TIMEOUT).toBe(1_200_000)
    expect(FRAMEWORK_PORT_TIMEOUT_MS).toBe(10 * 60 * 1000)
    expect(FRAMEWORK_PORT_WARN_TIMEOUT_MS).toBe(5 * 1000)
    expect(AGENT_PORT_TIMEOUT).toBe(50)
    expect(REQUEST_TIMEOUT).toBe(10000)
  })
})

describe('getFunctionTimeout', () => {
  test('should return default sync timeout for sync functions', () => {
    const result = getFunctionTimeout({})
    expect(result).toBe(30)
  })

  test('should return default background timeout for background functions', () => {
    const result = getFunctionTimeout({}, true)
    expect(result).toBe(900)
  })

  test('should return site-specific timeout from functionsTimeout', () => {
    const siteConfig = { functionsTimeout: 60 }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(60)
  })

  test('should return site-specific timeout from functionsConfig.timeout', () => {
    const siteConfig = { functionsConfig: { timeout: 120 } }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(120)
  })

  test('should prioritize functionsTimeout over functionsConfig.timeout', () => {
    const siteConfig = { 
      functionsTimeout: 60,
      functionsConfig: { timeout: 120 }
    }
    const result = getFunctionTimeout(siteConfig)
    expect(result).toBe(60)
  })

  test('should work with background functions and site config', () => {
    const siteConfig = { functionsTimeout: 1800 }
    const result = getFunctionTimeout(siteConfig, true)
    expect(result).toBe(1800)
  })
})

describe('getDeployTimeout', () => {
  test('should return default deploy timeout when no options provided', () => {
    const result = getDeployTimeout()
    expect(result).toBe(1_200_000)
  })

  test('should return default deploy timeout when empty options provided', () => {
    const result = getDeployTimeout({})
    expect(result).toBe(1_200_000)
  })

  test('should return custom timeout when provided', () => {
    const result = getDeployTimeout({ timeout: 600_000 })
    expect(result).toBe(600_000)
  })
})

describe('createTimeoutConfig', () => {
  test('should return default config when no overrides provided', () => {
    const result = createTimeoutConfig()
    expect(result).toEqual(DEFAULT_TIMEOUTS)
  })

  test('should return default config when empty overrides provided', () => {
    const result = createTimeoutConfig({})
    expect(result).toEqual(DEFAULT_TIMEOUTS)
  })

  test('should merge overrides with default config', () => {
    const overrides = { functionSync: 45, deploy: 800_000 }
    const result = createTimeoutConfig(overrides)
    expect(result).toEqual({
      ...DEFAULT_TIMEOUTS,
      functionSync: 45,
      deploy: 800_000,
    })
  })
})

describe('createTunnelTimeoutConfig', () => {
  test('should create tunnel config with provided poll timeout', () => {
    const result = createTunnelTimeoutConfig(5000)
    expect(result).toEqual({ pollTimeout: 5000 })
  })
})

describe('time conversion utilities', () => {
  test('secondsToMs should convert seconds to milliseconds', () => {
    expect(secondsToMs(30)).toBe(30000)
    expect(secondsToMs(1.5)).toBe(1500)
    expect(secondsToMs(0)).toBe(0)
  })

  test('msToSeconds should convert milliseconds to seconds', () => {
    expect(msToSeconds(30000)).toBe(30)
    expect(msToSeconds(1500)).toBe(2) // rounded
    expect(msToSeconds(1200)).toBe(1) // rounded
    expect(msToSeconds(0)).toBe(0)
  })
})