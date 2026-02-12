import { Pool as NeonPool } from '@neondatabase/serverless'
import pg from 'pg'
import type { SQL } from 'waddler'
import { waddler as waddlerNeonHttp } from 'waddler/neon-http'
import { waddler as waddlerNodePostgres } from 'waddler/node-postgres'

import { getEnvironment } from '@netlify/runtime-utils'

import { MissingDatabaseConnectionError } from './environment.js'

export interface GetDatabaseOptions {
  connectionString?: string
  debug?: boolean
}

export interface DatabaseConnection {
  sql: SQL
  pool: pg.Pool
  connectionString: string
}

export function getDatabase(options: GetDatabaseOptions = {}): DatabaseConnection {
  const env = getEnvironment()
  const connectionString = options.connectionString ?? env.get('NETLIFY_DB_URL')

  if (!connectionString) {
    throw new MissingDatabaseConnectionError()
  }

  const driver = env.get('NETLIFY_DB_DRIVER')

  if (driver === 'serverless') {
    return {
      sql: waddlerNeonHttp(connectionString),
      pool: new NeonPool({ connectionString }),
      connectionString,
    }
  }

  // Default ("server"): node-postgres for long-running servers
  const pool = new pg.Pool({ connectionString })

  return {
    sql: waddlerNodePostgres({ client: pool }),
    pool,
    connectionString,
  }
}

export { MissingDatabaseConnectionError }
