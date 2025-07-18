type Cache = 'off' | 'manual'

export type Path = `/${string}`

type OnError = 'fail' | 'bypass' | Path

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export type HeadersConfig = Record<string, boolean | string>

type RateLimitAggregator = 'domain' | 'ip'

type RateLimitAction = 'rate_limit' | 'rewrite'

/**
 * Netlify Custom Rate Limits inline configuration options.
 */
interface RateLimitConfig {
  action?: RateLimitAction
  aggregateBy?: RateLimitAggregator | RateLimitAggregator[]
  to?: string
  windowSize: number
}

/**
 * Netlify Edge Function inline configuration options.
 *
 * @see {@link https://docs.netlify.com/edge-functions/declarations/#declare-edge-functions-inline}
 */
export interface Config {
  cache?: Cache
  excludedPath?: Path | Path[]
  excludedPattern?: string | string[]
  header?: HeadersConfig
  onError?: OnError
  path?: Path | Path[]
  pattern?: string | string[]
  method?: HTTPMethod | HTTPMethod[]
  rateLimit?: RateLimitConfig
}

/**
 * Framework-generated Netlify Edge Function inline configuration options.
 *
 * @see {@link https://docs.netlify.com/edge-functions/create-integration/#generate-declarations}
 */
export interface IntegrationsConfig extends Config {
  name?: string
  generator?: string
}

/**
 * A function configuration in the `manifest.json` file for framework-generated Netlify
 * Edge Functions.
 *
 * @see {@link https://docs.netlify.com/edge-functions/declarations/#declare-edge-functions-inline}
 */
export interface ManifestFunction extends IntegrationsConfig {
  function: string
}

/**
 * The `manifest.json` file for framework-generated Netlify Edge Functions.
 *
 * @see {@link https://docs.netlify.com/edge-functions/create-integration/#generate-declarations}
 */
export interface Manifest {
  version: 1
  functions: ManifestFunction[]
  import_map?: string
}
