#!/usr/bin/env node

// Example: How to use timeout configuration in netlify/cli

import {
  // Import timeout constants
  SYNCHRONOUS_FUNCTION_TIMEOUT,
  BACKGROUND_FUNCTION_TIMEOUT,
  DEFAULT_DEPLOY_TIMEOUT,
  FRAMEWORK_PORT_TIMEOUT_MS,
  FRAMEWORK_PORT_WARN_TIMEOUT_MS,
  AGENT_PORT_TIMEOUT,
  REQUEST_TIMEOUT,
  
  // Import utility functions
  getFunctionTimeout,
  getDeployTimeout,
  createTimeoutConfig,
  createTunnelTimeoutConfig,
  secondsToMs,
  msToSeconds,
  
  // Import types
  type TimeoutConfig,
  type FunctionTimeoutConfig,
  type DeployTimeoutOptions,
} from '@netlify/dev-utils'

// Example 1: Replace existing timeout constants in netlify/cli
console.log('=== Timeout Constants ===')
console.log(`Synchronous Function Timeout: ${SYNCHRONOUS_FUNCTION_TIMEOUT}s`)
console.log(`Background Function Timeout: ${BACKGROUND_FUNCTION_TIMEOUT}s`)
console.log(`Deploy Timeout: ${DEFAULT_DEPLOY_TIMEOUT}ms (${msToSeconds(DEFAULT_DEPLOY_TIMEOUT)}s)`)
console.log(`Framework Server Timeout: ${FRAMEWORK_PORT_TIMEOUT_MS}ms (${msToSeconds(FRAMEWORK_PORT_TIMEOUT_MS)}s)`)
console.log(`Framework Server Warning: ${FRAMEWORK_PORT_WARN_TIMEOUT_MS}ms`)
console.log(`HTTP Agent Timeout: ${AGENT_PORT_TIMEOUT}s`)
console.log(`Geo-location Request Timeout: ${REQUEST_TIMEOUT}ms`)

// Example 2: Get function timeout with site configuration
console.log('\n=== Function Timeout Examples ===')

// Default sync function timeout
const defaultSync = getFunctionTimeout({})
console.log(`Default sync timeout: ${defaultSync}s`)

// Default background function timeout
const defaultBackground = getFunctionTimeout({}, true)
console.log(`Default background timeout: ${defaultBackground}s`)

// With site-specific timeout
const siteConfig: FunctionTimeoutConfig = {
  functionsTimeout: 60
}
const siteTimeout = getFunctionTimeout(siteConfig)
console.log(`Site-specific timeout: ${siteTimeout}s`)

// With function-specific timeout
const functionConfig: FunctionTimeoutConfig = {
  functionsConfig: {
    timeout: 120
  }
}
const funcTimeout = getFunctionTimeout(functionConfig)
console.log(`Function-specific timeout: ${funcTimeout}s`)

// Example 3: Deploy timeout with custom options
console.log('\n=== Deploy Timeout Examples ===')

// Default deploy timeout
const defaultDeploy = getDeployTimeout()
console.log(`Default deploy timeout: ${defaultDeploy}ms`)

// Custom deploy timeout
const customDeployOptions: DeployTimeoutOptions = {
  timeout: 900_000 // 15 minutes
}
const customDeploy = getDeployTimeout(customDeployOptions)
console.log(`Custom deploy timeout: ${customDeploy}ms`)

// Example 4: Create custom timeout configuration
console.log('\n=== Custom Timeout Configuration ===')

const customConfig = createTimeoutConfig({
  functionSync: 45,
  deploy: 800_000,
  geoLocation: 15000
})
console.log('Custom config:', customConfig)

// Example 5: Tunnel timeout configuration
console.log('\n=== Tunnel Timeout Configuration ===')

const tunnelConfig = createTunnelTimeoutConfig(5000)
console.log('Tunnel config:', tunnelConfig)

// Example 6: Time conversion utilities
console.log('\n=== Time Conversion ===')

const thirtySeconds = secondsToMs(30)
console.log(`30 seconds to milliseconds: ${thirtySeconds}ms`)

const twentyMinutes = msToSeconds(1_200_000)
console.log(`1,200,000 milliseconds to seconds: ${twentyMinutes}s`)

// Example of how this would be used in netlify/cli code:

// In src/utils/dev.ts
function getEffectiveFunctionTimeout(siteInfo: any, isBackground: boolean): number {
  const siteConfig: FunctionTimeoutConfig = {
    functionsTimeout: siteInfo.functions_timeout,
    functionsConfig: siteInfo.functions_config
  }
  
  return getFunctionTimeout(siteConfig, isBackground)
}

// In src/commands/deploy/index.ts
function getEffectiveDeployTimeout(options: { timeout?: number }): number {
  const deployOptions: DeployTimeoutOptions = {
    timeout: options.timeout
  }
  
  return getDeployTimeout(deployOptions)
}

// In src/utils/framework-server.ts
const serverTimeout = FRAMEWORK_PORT_TIMEOUT_MS
const warningTimeout = FRAMEWORK_PORT_WARN_TIMEOUT_MS

console.log('\n=== Integration Examples ===')
console.log(`Effective function timeout for site: ${getEffectiveFunctionTimeout({ functions_timeout: 90 }, false)}s`)
console.log(`Effective deploy timeout: ${getEffectiveDeployTimeout({ timeout: 600_000 })}ms`)
console.log(`Framework server timeout: ${serverTimeout}ms`)
console.log(`Framework warning timeout: ${warningTimeout}ms`)