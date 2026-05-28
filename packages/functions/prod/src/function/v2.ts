export type { Context } from '@netlify/types'

import type { FunctionRegion } from '@netlify/types'

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
  windowLimit: number
}

interface BaseConfig {
  /**
   * If `true`, the function runs in background (fire-and-forget) mode: the
   * platform returns an immediate response to the client and the function's
   * return value is discarded.
   */
  background?: boolean

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

  /**
   * Airport code for the region where the function should be deployed.
   *
   * @example
   * 'iad'
   */
  region?: FunctionRegion
}

type MemoryOrVcpu =
  | {
      /**
       * Maximum amount of memory (in MB) the function can use. Accepts either
       * a number (e.g. `2048`) or a human-friendly string (e.g. `"2gb"`,
       * `"1024mb"`).
       *
       * Mutually exclusive with `vcpu`.
       */
      memory?: number | string

      vcpu?: never
    }
  | {
      memory?: never

      /**
       * Number of vCPUs the function should be provisioned with. Allowed
       * range is 0.5–2.
       *
       * Mutually exclusive with `memory`.
       */
      vcpu?: number
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

export type Config = (ConfigWithPath | ConfigWithSchedule) & MemoryOrVcpu
