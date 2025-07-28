export type { Context } from '@netlify/types'

type Path = `/${string}`
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
type CronSchedule = string
type RateLimitAggregator = 'domain' | 'ip'
type RateLimitAction = 'rate_limit' | 'rewrite'

interface RateLimitConfig {
  action?: RateLimitAction
  aggregateBy?: RateLimitAggregator | RateLimitAggregator[]
  to?: string
  windowSize: number
}

interface BaseConfig {
  /**
   * Defines metadata about the framework or extension that has generated the
   * function, if applicable. Typically contains the nane and the version.
   * Should not be used for functions authored by users.
   */
  generator?: string

  /**
   * Limits the HTTP methods for which the function will run. If not set, the
   * function will run for all supported methods.
   */
  method?: HTTPMethod | HTTPMethod[]

  /**
   * Configures the function to serve any static files that match the request
   * URL and render the function only if no matching files exist.
   */
  preferStatic?: boolean

  /**
   * Set rate-limiting rules for this function.
   *
   * {@link} https://ntl.fyi/rate-limiting-code
   */
  rateLimit?: RateLimitConfig
}

interface ConfigWithPath extends BaseConfig {
  /**
   * One or more URL paths for which the function will not run, even if they
   * match a path defined with the `path` property. Paths must begin with a
   * forward slash.
   *
   * {@link} https://ntl.fyi/func-routing
   */
  excludedPath?: Path | Path[]

  /**
   * One or more URL paths for which the function will run. Paths must begin
   * with a forward slash.
   *
   * {@link} https://ntl.fyi/func-routing
   */
  path?: Path | Path[]

  /**
   * The `schedule` property cannot be used when `path` is used.
   */
  schedule?: never
}

interface ConfigWithSchedule extends BaseConfig {
  /**
   * The `excludedPath` property cannot be used when `schedule` is used.
   */
  excludedPath?: never

  /**
   * The `path` property cannot be used when `schedule` is used.
   */
  path?: never

  /**
   * Cron expression representing the schedule at which the function will be
   * automatically invoked.
   *
   * {@link} https://ntl.fyi/sched-func
   */
  schedule: CronSchedule
}

export type Config = ConfigWithPath | ConfigWithSchedule
