import { describe, expect, test } from 'vitest'
import type { TimeoutConfig, FunctionTimeoutConfig, DeployTimeoutOptions, TunnelTimeoutConfig } from './timeout.js'

describe('timeout types', () => {
  test('should have correct TimeoutConfig interface', () => {
    const config: TimeoutConfig = {
      functionSync: 30,
      functionBackground: 900,
      deploy: 1_200_000,
      frameworkServer: 600_000,
      frameworkServerWarn: 5_000,
      httpAgent: 50,
      geoLocation: 10000,
    }
    
    expect(config.functionSync).toBe(30)
    expect(config.functionBackground).toBe(900)
    expect(config.deploy).toBe(1_200_000)
    expect(config.frameworkServer).toBe(600_000)
    expect(config.frameworkServerWarn).toBe(5_000)
    expect(config.httpAgent).toBe(50)
    expect(config.geoLocation).toBe(10000)
  })

  test('should have correct FunctionTimeoutConfig interface', () => {
    const config: FunctionTimeoutConfig = {
      functionsTimeout: 60,
      functionsConfig: {
        timeout: 120,
      },
    }
    
    expect(config.functionsTimeout).toBe(60)
    expect(config.functionsConfig?.timeout).toBe(120)

    // Test with optional fields
    const minimalConfig: FunctionTimeoutConfig = {}
    expect(minimalConfig.functionsTimeout).toBeUndefined()
    expect(minimalConfig.functionsConfig).toBeUndefined()
  })

  test('should have correct DeployTimeoutOptions interface', () => {
    const options: DeployTimeoutOptions = {
      timeout: 600_000,
    }
    
    expect(options.timeout).toBe(600_000)

    // Test with optional fields
    const minimalOptions: DeployTimeoutOptions = {}
    expect(minimalOptions.timeout).toBeUndefined()
  })

  test('should have correct TunnelTimeoutConfig interface', () => {
    const config: TunnelTimeoutConfig = {
      pollTimeout: 5000,
    }
    
    expect(config.pollTimeout).toBe(5000)
  })
})