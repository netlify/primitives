export interface CacheHeadersOptions {
  /**
   * Persist the response in the durable cache, shared across all CDN nodes.
   *
   * {@link} https://ntl.fyi/durable
   */
  durable?: boolean

  /**
   * Override the default behavior of revalidating cached responses with new
   * deploys. You must provide one or more values that will be registered as
   * cache tags for you to purge the responses on-demand.
   *
   * {@link} https://ntl.fyi/cache-id
   */
  overrideDeployRevalidation?: string | string[]

  /**
   * Provide one or more cache tags to associate with the response. You can use
   * these tags to revalidate responses on-demand, making sure you target the
   * specific responses you want based on your application logic.
   *
   * {@link} https://ntl.fyi/cache-tags
   */
  tags?: string[]

  /**
   * Define the period of time (in seconds) during which the response can be
   * considered fresh. After this period, the response will revalidated in
   * the background if used with the `stale-while-revalidate` directive,
   * otherwise the response will be discarded.
   *
   * {@link} https://ntl.fyi/cache-ttl
   */
  ttl?: number

  /**
   * Define the period of time (in seconds) after the response is considered
   * stale (set by the `ttl` property) and during which it can still
   * be served, while starting a revalidation in the background.
   *
   * {@link} https://ntl.fyi/cache-swr
   */
  swr?: boolean | number

  /**
   * Defines how cache key variations are created for the response, giving you
   * fine-grained control over which parts of a request are taken into
   * consideration for matching cache objects.
   *
   * {@link} https://ntl.fyi/cache-vary
   */
  vary?: VaryOptions
}

export interface VaryOptions {
  /**
   * Define cache key variations based on a subset of cookie keys.
   */
  cookie?: string | string[]

  /**
   * Define cache key variations based on the geographical origin of the request.
   */
  country?: string | (string | string[])[]

  /**
   * Define cache key variations based on your custom request headers and most
   * standard request headers.
   */
  header?: string | string[]

  /**
   * Define cache key variations for one or more individual languages or custom
   * language groups.
   */
  language?: string | (string | string[])[]

  /**
   * Define cache key variations based on a specific subset of query parameters
   * included with a request or all request query parameters.
   */
  query?: boolean | string | string[]
}
