import postgres from 'postgres'
import type { Sql } from 'postgres'

import { getEnvironment, MissingDatabaseConnectionError } from './environment.js'

export interface GetDatabaseOptions {
  /** Override the NETLIFY_DB_URL connection string */
  connectionString?: string
  /** Enable debug mode to log PostgreSQL notices */
  debug?: boolean
}

/**
 * Returns a postgres client configured with the `NETLIFY_DB_URL` environment
 * variable, or with a custom connection string if provided.
 */
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
