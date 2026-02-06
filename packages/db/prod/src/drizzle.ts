import { neon, Pool as NeonPool } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import pg from 'pg'

import { getEnvironment } from '@netlify/runtime-utils'

import { MissingDatabaseConnectionError } from './environment.js'

export interface GetDrizzleClientOptions {
  connectionString?: string
}

export interface ServerlessDrizzleClient {
  driver: 'serverless'
  httpClient: NeonQueryFunction<false, false>
  pool: NeonPool
  connectionString: string
}

export interface ServerDrizzleClient {
  driver: 'server'
  pool: pg.Pool
  connectionString: string
}

export type DrizzleClient = ServerlessDrizzleClient | ServerDrizzleClient

export function getDrizzleClient(options: GetDrizzleClientOptions = {}): DrizzleClient {
  const env = getEnvironment()
  const connectionString = options.connectionString ?? env.get('NETLIFY_DB_URL')

  if (!connectionString) {
    throw new MissingDatabaseConnectionError()
  }

  const driver = env.get('NETLIFY_DB_DRIVER')

  if (driver === 'serverless') {
    return {
      driver: 'serverless',
      httpClient: neon(connectionString),
      pool: new NeonPool({ connectionString }),
      connectionString,
    }
  }

  return {
    driver: 'server',
    pool: new pg.Pool({ connectionString }),
    connectionString,
  }
}

export { MissingDatabaseConnectionError }
// Re-export types so Drizzle adapter doesn't need direct @neondatabase/serverless dep
export type { NeonQueryFunction } from '@neondatabase/serverless'
export { Pool as NeonPool } from '@neondatabase/serverless'
