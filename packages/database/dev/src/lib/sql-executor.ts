export interface SQLExecutor {
  exec(sql: string): Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  transaction<T>(fn: (tx: Pick<SQLExecutor, 'exec' | 'query'>) => Promise<T>): Promise<T>
}
