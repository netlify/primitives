import { neon, neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import ws from 'ws'
import pg from 'pg'
import type { SQL } from 'waddler'
import { waddler as waddlerNeonHttp } from 'waddler/neon-http'
import { waddler as waddlerNodePostgres } from 'waddler/node-postgres'

import { getEnvironment } from '@netlify/runtime-utils'

import { MissingDatabaseConnectionError } from './environment.js'

export type Role = 'netlifydb_owner' | 'netlifydb_readonly'

export const ownerRole: Role = 'netlifydb_owner'
export const readOnlyRole: Role = 'netlifydb_readonly'

export interface GetDatabaseOptions {
  connectionString?: string
  debug?: boolean
  role?: Role
}

export interface ServerDatabaseConnection {
  driver: 'server'
  sql: SQL
  pool: pg.Pool
  connectionString: string
}

export interface ServerlessDatabaseConnection {
  driver: 'serverless'
  sql: SQL
  pool: NeonPool
  // Using <any, any> because neon() returns NeonQueryFunction<false, false>,
  // which is incompatible with drizzle-orm's NeonHttpClient (NeonQueryFunction<any, any>)
  // due to contravariance in the transaction method's generic parameters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpClient: NeonQueryFunction<any, any>
  connectionString: string
}

export type DatabaseConnection = ServerDatabaseConnection | ServerlessDatabaseConnection

export function getDatabase(options: GetDatabaseOptions = {}): DatabaseConnection {
  const env = getEnvironment()
  const baseConnectionString = options.connectionString ?? env.get('NETLIFY_DB_URL')

  if (!baseConnectionString) {
    throw new MissingDatabaseConnectionError()
  }

  const role = options.role ?? ownerRole
  const url = new URL(baseConnectionString)
  url.searchParams.set('role', role)
  const connectionString = url.toString()

  const driver = env.get('NETLIFY_DB_DRIVER')

  if (driver === 'serverless') {
    // We can remove this, and the dependency on `ws`, once we stop supporting
    // Node.js 22.
    /* eslint-disable n/no-unsupported-features/node-builtins */
    if (!neonConfig.webSocketConstructor && typeof WebSocket === 'undefined') {
      neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket
    }
    /* eslint-enable n/no-unsupported-features/node-builtins */

    const httpClient = neon(connectionString)

    return {
      driver: 'serverless',
      sql: waddlerNeonHttp({ client: httpClient }),
      pool: new NeonPool({ connectionString }),
      httpClient,
      connectionString,
    }
  }

  // Default ("server"): node-postgres for long-running servers
  const pool = new pg.Pool({ connectionString })

  return {
    driver: 'server',
    sql: waddlerNodePostgres({ client: pool }),
    pool,
    connectionString,
  }
}

export { MissingDatabaseConnectionError }
