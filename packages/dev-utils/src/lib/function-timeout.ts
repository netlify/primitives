import type { FunctionTimeoutConfig } from '@netlify/types'

/**
 * Default timeout for synchronous functions in seconds
 */
export const SYNCHRONOUS_FUNCTION_TIMEOUT = 30

/**
 * Default timeout for background functions in seconds
 */
export const BACKGROUND_FUNCTION_TIMEOUT = 900

/**
 * Get the effective function timeout considering site-specific configuration
 * @param siteConfig - Site configuration with timeout options
 * @param isBackground - Whether this is a background function
 * @returns Function timeout in seconds
 */
export function getFunctionTimeout(
  siteConfig: FunctionTimeoutConfig,
  isBackground = false
): number {
  // Check for site-specific timeout configuration
  const siteTimeout = siteConfig.functionsTimeout ?? siteConfig.functionsConfig?.timeout

  if (siteTimeout) {
    return siteTimeout
  }

  // Use default timeout based on function type
  return isBackground ? BACKGROUND_FUNCTION_TIMEOUT : SYNCHRONOUS_FUNCTION_TIMEOUT
}