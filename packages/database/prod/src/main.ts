import { neon, neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import ws from 'ws'
import pg from 'pg'
import type { SQL } from 'waddler'
import { waddler as waddlerNeonHttp } from 'waddler/neon-http'
import { waddler as waddlerNodePostgres } from 'waddler/node-postgres'

import { getEnvironment } from '@netlify/runtime-utils'

import { MissingDatabaseConnectionError } from './environment.js'

type NeonHttpClient = ReturnType<typeof neon>

export interface GetDatabaseOptions {
  connectionString?: string
  debug?: boolean
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
  httpClient: NeonHttpClient
  connectionString: string
}

export type DatabaseConnection = ServerDatabaseConnection | ServerlessDatabaseConnection

export function getConnectionString(): string {
  const env = getEnvironment()
  const connectionString = env.get('NETLIFY_DB_URL')

  if (!connectionString) {
    throw new MissingDatabaseConnectionError()
  }

  return connectionString
}

function ensureNeonWebSocket(): void {
  // We can remove this, and the dependency on `ws`, once we stop supporting
  // Node.js 22.
  /* eslint-disable n/no-unsupported-features/node-builtins */
  if (!neonConfig.webSocketConstructor && typeof WebSocket === 'undefined') {
    neonConfig.webSocketConstructor = ws
  }
  /* eslint-enable n/no-unsupported-features/node-builtins */
}

// Returns an HTTP client that lazily loads the connection string from the
// environment and, when it changes, rebuilds the underlying Neon client.
//
// A Proxy is used because the client is both callable (tagged-template queries)
// and carries methods (`query`, `transaction`, `unsafe`).
function createRefreshingHttpClient(readConnectionString: () => string): NeonHttpClient {
  let cachedConnectionString: string | undefined
  let cachedClient: NeonHttpClient | undefined

  const getClient = (): NeonHttpClient => {
    const connectionString = readConnectionString()

    if (connectionString !== cachedConnectionString || cachedClient === undefined) {
      cachedConnectionString = connectionString
      cachedClient = neon(connectionString)
    }

    return cachedClient
  }

  // Construct eagerly so getDatabase() fails fast and the client is warm.
  getClient()

  // The Proxy target is a throwaway callable — it only has to be a callable
  // object for the traps to attach.
  const target = (() => undefined) as unknown as NeonHttpClient

  return new Proxy<NeonHttpClient>(target, {
    apply: (_target, _thisArg, args: unknown[]) => (getClient() as (...callArgs: unknown[]) => unknown)(...args),
    get: (_target, prop, receiver) => {
      const value: unknown = Reflect.get(getClient(), prop, receiver)

      // Data property: nothing to defer, hand back the value as-is.
      if (typeof value !== 'function') {
        return value
      }

      // Method: return a wrapper so the call is deferred to a freshly-resolved
      // client. This is what makes a captured method reference use the updated
      // credentials after rotation.
      return (...args: unknown[]): unknown => {
        const fn = Reflect.get(getClient(), prop, receiver) as (...callArgs: unknown[]) => unknown

        return fn.apply(getClient(), args)
      }
    },
  })
}

export function getDatabase(options: GetDatabaseOptions = {}): DatabaseConnection {
  const env = getEnvironment()
  const { connectionString: override } = options

  const readConnectionString = (): string => {
    const connectionString = override ?? env.get('NETLIFY_DB_URL')
    if (!connectionString) {
      throw new MissingDatabaseConnectionError()
    }

    return connectionString
  }

  const connectionString = readConnectionString()
  const driver = env.get('NETLIFY_DB_DRIVER')

  if (driver === 'serverless') {
    ensureNeonWebSocket()

    const httpClient = createRefreshingHttpClient(readConnectionString)

    // Unlike the stateless HTTP client, a pool holds live, already-authenticated
    // connections, so it can't transparently swap credentials, as that would
    // mean tearing down the pool and interrupting in-flight queries. It stays
    // pinned to the connection string at construction.
    const pool = new NeonPool({ connectionString })

    return {
      driver: 'serverless',
      sql: waddlerNeonHttp({ client: httpClient }),
      pool,
      httpClient,
      get connectionString() {
        return readConnectionString()
      },
    }
  }

  // Default ("server"): node-postgres for long-running servers.
  const pool = new pg.Pool({ connectionString })

  return {
    driver: 'server',
    sql: waddlerNodePostgres({ client: pool }),
    pool,
    get connectionString() {
      return readConnectionString()
    },
  }
}

export { MissingDatabaseConnectionError }
