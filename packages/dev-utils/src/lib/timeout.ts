// Timeout type definitions
interface TimeoutConfig {
  /**
   * Default timeout for synchronous functions in seconds
   */
  functionSync: number
  /**
   * Default timeout for background functions in seconds
   */
  functionBackground: number
  /**
   * Default timeout for deployments in milliseconds
   */
  deploy: number
  /**
   * Default timeout for framework server startup in milliseconds
   */
  frameworkServer: number
  /**
   * Warning timeout for framework server startup in milliseconds
   */
  frameworkServerWarn: number
  /**
   * Timeout for HTTP agent connections in seconds
   */
  httpAgent: number
  /**
   * Timeout for geo-location requests in milliseconds
   */
  geoLocation: number
}

interface FunctionTimeoutConfig {
  /**
   * Site-specific function timeout in seconds
   */
  functionsTimeout?: number
  /**
   * Function-specific timeout configuration
   */
  functionsConfig?: {
    timeout?: number
  }
}

interface DeployTimeoutOptions {
  /**
   * Custom timeout for deployment in milliseconds
   */
  timeout?: number
}

interface TunnelTimeoutConfig {
  /**
   * Timeout for live tunnel polling
   */
  pollTimeout: number
}

/**
 * Default timeout configuration constants
 */
export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  /**
   * Default timeout for synchronous functions (30 seconds)
   */
  functionSync: 30,
  /**
   * Default timeout for background functions (900 seconds = 15 minutes)
   */
  functionBackground: 900,
  /**
   * Default timeout for deployments (1,200,000 ms = 20 minutes)
   */
  deploy: 1_200_000,
  /**
   * Default timeout for framework server startup (600,000 ms = 10 minutes)
   */
  frameworkServer: 10 * 60 * 1000,
  /**
   * Warning timeout for framework server startup (5,000 ms = 5 seconds)
   */
  frameworkServerWarn: 5 * 1000,
  /**
   * Default timeout for HTTP agent connections (50 seconds)
   */
  httpAgent: 50,
  /**
   * Default timeout for geo-location requests (10,000 ms = 10 seconds)
   */
  geoLocation: 10000,
}

/**
 * Individual timeout constants for easier access
 */
export const SYNCHRONOUS_FUNCTION_TIMEOUT = 30
export const BACKGROUND_FUNCTION_TIMEOUT = 900
export const DEFAULT_DEPLOY_TIMEOUT = 1_200_000
export const FRAMEWORK_PORT_TIMEOUT_MS = 10 * 60 * 1000
export const FRAMEWORK_PORT_WARN_TIMEOUT_MS = 5 * 1000
export const AGENT_PORT_TIMEOUT = 50
export const REQUEST_TIMEOUT = 10000

/**
 * Get the effective function timeout considering site-specific configuration
 */
export function getFunctionTimeout(
  siteConfig: FunctionTimeoutConfig,
  isBackground: boolean = false
): number {
  // Check for site-specific timeout configuration
  const siteTimeout = siteConfig.functionsTimeout || siteConfig.functionsConfig?.timeout

  if (siteTimeout) {
    return siteTimeout
  }

  // Use default timeout based on function type
  return isBackground ? DEFAULT_TIMEOUTS.functionBackground : DEFAULT_TIMEOUTS.functionSync
}

/**
 * Get the effective deploy timeout considering custom options
 */
export function getDeployTimeout(options: DeployTimeoutOptions = {}): number {
  return options.timeout || DEFAULT_TIMEOUTS.deploy
}

/**
 * Create a timeout configuration with custom overrides
 */
export function createTimeoutConfig(overrides: Partial<TimeoutConfig> = {}): TimeoutConfig {
  return {
    ...DEFAULT_TIMEOUTS,
    ...overrides,
  }
}

/**
 * Create a tunnel timeout configuration
 */
export function createTunnelTimeoutConfig(pollTimeout: number): TunnelTimeoutConfig {
  return {
    pollTimeout,
  }
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(milliseconds: number): number {
  return Math.round(milliseconds / 1000)
}

// Export timeout types for external use
export type { TimeoutConfig, FunctionTimeoutConfig, DeployTimeoutOptions, TunnelTimeoutConfig }