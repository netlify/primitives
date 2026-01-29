import postgres from 'postgres'
import type { Sql } from 'postgres'

import { getEnvironment, MissingDatabaseConnectionError } from './environment.js'

export interface GetDatabaseOptions {
  /**
   * Override the default connection string found in the Netlify environment.
   */
  connectionString?: string

  /**
   * Enable debug mode to log messages emitted by the Postgres engine.
   */
  debug?: boolean
}

export function getDatabase(options: GetDatabaseOptions = {}): Sql {
  const connectionString = options.connectionString ?? getEnvironment().get('NETLIFY_DB_URL')

  if (!connectionString) {
    throw new MissingDatabaseConnectionError()
  }

  return postgres(connectionString, {
    onnotice: options.debug ? console.log : () => {},
  })
}

export { MissingDatabaseConnectionError }
export type { Sql }
