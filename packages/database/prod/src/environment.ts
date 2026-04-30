export class MissingDatabaseConnectionError extends Error {
  constructor() {
    super(
      'The environment has not been configured to use Netlify Database. You must supply the `connectionString` option when calling `getDatabase()`. See https://ntl.fyi/database-environment for details.',
    )

    this.name = 'MissingDatabaseConnectionError'
  }
}
