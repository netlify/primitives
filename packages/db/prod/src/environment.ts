export { getEnvironment } from '@netlify/runtime-utils'

export class MissingDatabaseConnectionError extends Error {
  constructor() {
    super(
      'The environment has not been configured to use Netlify DB. To use it manually, supply the `connectionString` option when calling `getDatabase()`.',
    )

    this.name = 'MissingDatabaseConnectionError'
  }
}
