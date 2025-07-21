export interface Site {
  id?: string
  name?: string
  url?: string
}

/**
 * Site configuration for function timeout options
 */
export interface SiteConfig {
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
