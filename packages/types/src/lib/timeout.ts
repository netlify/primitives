export interface TimeoutConfig {
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

export interface DeployTimeoutOptions {
  /**
   * Custom timeout for deployment in milliseconds
   */
  timeout?: number
}

export interface TunnelTimeoutConfig {
  /**
   * Timeout for live tunnel polling
   */
  pollTimeout: number
}