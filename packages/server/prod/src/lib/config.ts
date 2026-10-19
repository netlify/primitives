import type { ServerRegion, ServerSize } from '@netlify/types'

type Path = `/${string}`

export interface Config {
  /**
   * Glob patterns of files to ship alongside the server, relative to the file
   * that declares this config. Useful for files the server reads at runtime.
   */
  includedFiles?: string[]

  /**
   * One or more URL paths the server handles. Paths must begin with a forward
   * slash. Defaults to `/*`, which is every path the rest of the site does not
   * claim. Static files always take precedence over the server.
   *
   * @example
   * ['/api/*', '/auth/callback']
   */
  path?: Path | Path[]

  /**
   * One or more URL paths within `path` that the server doesn't handle. Paths
   * must begin with a forward slash.
   *
   * @example
   * ['/api/internal', '/api/admin/*']
   */
  excludedPath?: Path | Path[]

  /**
   * Airport code for the region where the server should run.
   *
   * @example
   * 'cmh'
   */
  region?: ServerRegion

  /**
   * Size of the instances the server runs on. Defaults to `small`.
   *
   * @example
   * 'medium'
   */
  size?: ServerSize
}
