import { neon, neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import ws from 'ws'
import pg from 'pg'
import type { SQL } from 'waddler'
import { waddler as waddlerNeonHttp } from 'waddler/neon-http'
import { waddler as waddlerNodePostgres } from 'waddler/node-postgres'

import { getEnvironment } from '@netlify/runtime-utils'

import { MissingDatabaseConnectionError } from './environment.js'

export type RoleType = 'owner' | 'read-only'

export interface GetDatabaseOptions {
  connectionString?: string
  debug?: boolean
  role?: RoleType
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
  httpClient: NeonQueryFunction<false, false>
  connectionString: string
}

export type DatabaseConnection = ServerDatabaseConnection | ServerlessDatabaseConnection

export function getDatabase(options: GetDatabaseOptions = {}): DatabaseConnection {
  const env = getEnvironment()
  const baseConnectionString = options.connectionString ?? env.get('NETLIFY_DB_URL')

  if (!baseConnectionString) {
    throw new MissingDatabaseConnectionError()
  }

  const roleType = options.role ?? 'owner'
  const url = new URL(baseConnectionString)
  url.searchParams.set('role_type', roleType)
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
