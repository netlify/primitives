export interface SQLExecutor {
  exec(sql: string): Promise<unknown>
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  transaction<T>(fn: (tx: Pick<SQLExecutor, 'exec' | 'query'>) => Promise<T>): Promise<T>
}
