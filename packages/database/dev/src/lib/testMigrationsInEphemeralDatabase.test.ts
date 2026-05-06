import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import tmp from 'tmp-promise'
import { test, expect, afterEach } from 'vitest'

import { testMigrationsInEphemeralDatabase } from '../main.js'

let tmpDir: tmp.DirectoryResult | undefined

afterEach(async () => {
  if (tmpDir) {
    await tmpDir.cleanup()
    tmpDir = undefined
  }
})

async function createMigrationDir(basePath: string, name: string, sql: string) {
  const dir = join(basePath, name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, 'migration.sql'), sql)
}

async function createFlatMigration(basePath: string, name: string, sql: string) {
  await fs.writeFile(join(basePath, `${name}.sql`), sql)
}

test('Returns success with applied migrations when all apply cleanly', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)')
  await createMigrationDir(tmpDir.path, '0002_add_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('success')
  if (result.status !== 'success') return
  expect(result.applied).toHaveLength(2)
  expect(result.applied.map((m) => m.name)).toEqual(['0001_create_users', '0002_add_posts'])
})

test('Returns success with empty applied when migrations directory is missing', async () => {
  const result = await testMigrationsInEphemeralDatabase('/nonexistent/path/to/migrations')

  expect(result.status).toBe('success')
  if (result.status !== 'success') return
  expect(result.applied).toEqual([])
})

test('Returns success with empty applied when migrations directory is empty', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('success')
  if (result.status !== 'success') return
  expect(result.applied).toEqual([])
})

test('Returns failure with duplicate-name issue when a directory and flat file share a name', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createFlatMigration(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return
  expect(result.issues).toHaveLength(1)

  const issue = result.issues[0]
  expect(issue.kind).toBe('duplicate-name')
  if (issue.kind !== 'duplicate-name') return
  expect(issue.name).toBe('0001_create_users')
  expect(issue.version).toBe(1)
  expect(issue.files).toHaveLength(2)
  expect(issue.summary).toBe('Two or more migrations share the name "0001_create_users".')
  expect(issue.remediation).toBe('Delete one of the duplicate files before applying.')
})

test('Returns failure with duplicate-version issue when distinct migrations share a version', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createFlatMigration(tmpDir.path, '0001_create_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return
  expect(result.issues).toHaveLength(1)

  const issue = result.issues[0]
  expect(issue.kind).toBe('duplicate-version')
  if (issue.kind !== 'duplicate-version') return
  expect(issue.version).toBe(1)
  expect(issue.files.map((f) => f.name).sort()).toEqual(['0001_create_posts', '0001_create_users'])
  // File order in the summary depends on readdir order, so allow either.
  expect(issue.summary).toMatch(
    /^Version 1 is used by multiple migrations: ("0001_create_users", "0001_create_posts"|"0001_create_posts", "0001_create_users")\.$/,
  )
  expect(issue.remediation).toBe(
    'Increment one of the prefixes so ordering is unambiguous, or delete a file if it was an unintended duplicate.',
  )
})

test('Reports both duplicate-name and duplicate-version issues at once', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  // Two with the same name
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createFlatMigration(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  // A third with a different name but the same version — triggers duplicate-version too
  await createFlatMigration(tmpDir.path, '0001_create_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return
  const kinds = result.issues.map((i) => i.kind).sort()
  expect(kinds).toEqual(['duplicate-name', 'duplicate-version'])
})

test('Returns failure with migration-file-error (missing) when a migration directory has no migration.sql', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await fs.mkdir(join(tmpDir.path, '0001_create_users'))

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return
  expect(result.issues).toHaveLength(1)

  const issue = result.issues[0]
  expect(issue.kind).toBe('migration-file-error')
  if (issue.kind !== 'migration-file-error') return
  expect(issue.reason).toBe('missing')
  expect(issue.migrationName).toBe('0001_create_users')
  expect(issue.sqlPath).toMatch(/0001_create_users[/\\]migration\.sql$/)
  // The path is absolute and varies per run, so anchor the rest of the wording around it.
  expect(issue.summary).toMatch(
    /^Migration "0001_create_users" is missing its SQL file at .+0001_create_users[/\\]migration\.sql\.$/,
  )
  expect(issue.remediation).toMatch(
    /^Create the file at .+0001_create_users[/\\]migration\.sql, or remove the migration's directory if it isn't intended\.$/,
  )
})

test('Returns failure with apply-failure issue when a migration has a syntax error', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createMigrationDir(tmpDir.path, '0002_bad', 'INVALID SQL SYNTAX HERE')
  await createMigrationDir(tmpDir.path, '0003_create_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return
  expect(result.issues).toHaveLength(1)

  const issue = result.issues[0]
  expect(issue.kind).toBe('apply-failure')
  if (issue.kind !== 'apply-failure') return
  expect(issue.migration.name).toBe('0002_bad')
  expect(issue.appliedBefore.map((m) => m.name)).toEqual(['0001_create_users'])
  expect(issue.remaining.map((m) => m.name)).toEqual(['0003_create_posts'])
  expect(issue.pgError.code).toBe('42601')
  expect(issue.pgError.message).toBe('syntax error at or near "INVALID"')
  expect(issue.summary).toBe('Migration "0002_bad" failed to apply: syntax error at or near "INVALID"')
  expect(issue.remediation).toBe(
    'This may be a problem in the SQL of "0002_bad" itself (for example, a syntax error), ' +
      'or in the cumulative database state left by previously applied migrations ' +
      '(for example, the migration tries to create an object that an earlier migration already created, ' +
      "or references one that was never created). Postgres returned SQLSTATE 42601; look that up for common causes. " +
      'Resolve the issue in the failing migration or in the prior ones before deploying.',
  )
})

test('Returns failure with apply-failure issue when a migration creates a relation that already exists', async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createMigrationDir(tmpDir.path, '0002_create_users_again', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')

  const result = await testMigrationsInEphemeralDatabase(tmpDir.path)

  expect(result.status).toBe('failure')
  if (result.status !== 'failure') return

  const issue = result.issues[0]
  expect(issue.kind).toBe('apply-failure')
  if (issue.kind !== 'apply-failure') return
  expect(issue.appliedBefore.map((m) => m.name)).toEqual(['0001_create_users'])
  expect(issue.migration.name).toBe('0002_create_users_again')
  expect(issue.pgError.code).toBe('42P07')
  expect(issue.pgError.message).toBe('relation "users" already exists')
  expect(issue.summary).toBe(
    'Migration "0002_create_users_again" failed to apply: relation "users" already exists',
  )
  expect(issue.remediation).toBe(
    'This may be a problem in the SQL of "0002_create_users_again" itself (for example, a syntax error), ' +
      'or in the cumulative database state left by previously applied migrations ' +
      '(for example, the migration tries to create an object that an earlier migration already created, ' +
      "or references one that was never created). Postgres returned SQLSTATE 42P07; look that up for common causes. " +
      'Resolve the issue in the failing migration or in the prior ones before deploying.',
  )
})
