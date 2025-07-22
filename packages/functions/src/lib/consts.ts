import type { SiteConfig } from '@netlify/types'

const BUILDER_FUNCTIONS_FLAG = true
const HTTP_STATUS_METHOD_NOT_ALLOWED = 405
const HTTP_STATUS_OK = 200
const METADATA_VERSION = 1

/**
 * Default timeout for synchronous functions in seconds
 */
const SYNCHRONOUS_FUNCTION_TIMEOUT = 30

/**
 * Default timeout for background functions in seconds
 */
const BACKGROUND_FUNCTION_TIMEOUT = 900

export {
  BUILDER_FUNCTIONS_FLAG,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_OK,
  METADATA_VERSION,
  SYNCHRONOUS_FUNCTION_TIMEOUT,
  BACKGROUND_FUNCTION_TIMEOUT,
}
