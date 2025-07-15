/**
 * Configuration for function timeout options
 */
export interface FunctionTimeoutConfig {
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