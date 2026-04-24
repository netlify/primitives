import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import tmp from 'tmp-promise'
import { test, expect, afterEach } from 'vitest'

import { NetlifyDB } from '../main.js'
import { applyMigrations } from './migrations.js'

let db: PGlite | undefined
let tmpDir: tmp.DirectoryResult | undefined

afterEach(async () => {
  if (db) {
    await db.close()
    db = undefined
  }

  if (tmpDir) {
    await fs.rm(tmpDir.path, { force: true, recursive: true })
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

async function setupMigrations(migrations: { name: string; sql: string }[]) {
  tmpDir = await tmp.dir()

  for (const { name, sql } of migrations) {
    await createMigrationDir(tmpDir.path, name, sql)
  }

  db = await PGlite.create()

  return { migrationsDir: tmpDir.path, db }
}

test('Applies all migrations when no target is specified', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
    { name: '0003_add_comments', sql: 'CREATE TABLE comments (id SERIAL PRIMARY KEY, body TEXT)' },
  ])

  const applied = await applyMigrations(pgDb, migrationsDir)

  expect(applied).toHaveLength(3)
  expect(applied[0]).toBe('0001_create_users')
  expect(applied[1]).toBe('0002_add_posts')
  expect(applied[2]).toBe('0003_add_comments')

  // Verify all tables were created
  const usersResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'users'")
  expect(usersResult.rows).toHaveLength(1)

  const postsResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'")
  expect(postsResult.rows).toHaveLength(1)

  const commentsResult = await pgDb.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'comments'",
  )
  expect(commentsResult.rows).toHaveLength(1)
})

test('Applies all migrations up to named target', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
    { name: '0003_add_comments', sql: 'CREATE TABLE comments (id SERIAL PRIMARY KEY, body TEXT)' },
  ])

  const applied = await applyMigrations(pgDb, migrationsDir, '0002_add_posts')

  expect(applied).toHaveLength(2)
  expect(applied[0]).toBe('0001_create_users')
  expect(applied[1]).toBe('0002_add_posts')

  // Verify tables were created
  const usersResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'users'")
  expect(usersResult.rows).toHaveLength(1)

  const postsResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'")
  expect(postsResult.rows).toHaveLength(1)

  // Migration 3 should NOT have been applied
  const commentsResult = await pgDb.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'comments'",
  )
  expect(commentsResult.rows).toHaveLength(0)
})

test('Skips already-applied migrations (idempotency)', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
  ])

  // Apply first time
  const first = await applyMigrations(pgDb, migrationsDir, '0002_add_posts')
  expect(first).toHaveLength(2)

  // Apply again — should skip all
  const second = await applyMigrations(pgDb, migrationsDir, '0002_add_posts')
  expect(second).toHaveLength(0)
})

test('Applies incrementally (apply to A, then later to B)', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
    { name: '0003_add_comments', sql: 'CREATE TABLE comments (id SERIAL PRIMARY KEY, body TEXT)' },
  ])

  // Apply up to migration 1
  const first = await applyMigrations(pgDb, migrationsDir, '0001_create_users')
  expect(first).toHaveLength(1)
  expect(first[0]).toBe('0001_create_users')

  // Apply up to migration 3 — should only apply 2 and 3
  const second = await applyMigrations(pgDb, migrationsDir, '0003_add_comments')
  expect(second).toHaveLength(2)
  expect(second[0]).toBe('0002_add_posts')
  expect(second[1]).toBe('0003_add_comments')
})

test('Resolves target by prefix only', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
  ])

  const applied = await applyMigrations(pgDb, migrationsDir, '0002')

  expect(applied).toHaveLength(2)
  expect(applied[1]).toBe('0002_add_posts')
})

test('Throws DatabaseNotStartedError if start() not called', async () => {
  const server = new NetlifyDB()

  await expect(server.applyMigrations('/nonexistent', '0001')).rejects.toThrow('Database has not been started')
})

test('Throws MigrationDirectoryNotFoundError for missing directory', async () => {
  db = await PGlite.create()

  await expect(applyMigrations(db, '/nonexistent/path', '0001')).rejects.toThrow('Migration directory not found')
})

test('Throws MigrationNotFoundError for unknown target', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
  ])

  await expect(applyMigrations(pgDb, migrationsDir, '9999_nonexistent')).rejects.toThrow(
    'No migration found matching target',
  )
})

test('Throws MigrationFileNotFoundError for directory missing migration.sql', async () => {
  tmpDir = await tmp.dir()

  // Create a directory without migration.sql
  await fs.mkdir(join(tmpDir.path, '0001_missing_file'))

  db = await PGlite.create()

  await expect(applyMigrations(db, tmpDir.path, '0001_missing_file')).rejects.toThrow(
    /Migration SQL file not found: .*0001_missing_file[/\\]migration.sql/,
  )
})

test('Rolls back failed migration, preserves prior successful ones', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_bad_migration', sql: 'INVALID SQL SYNTAX HERE' },
    { name: '0003_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
  ])

  await expect(applyMigrations(pgDb, migrationsDir, '0003_add_posts')).rejects.toThrow()

  // Migration 1 should be committed
  const tracking = await pgDb.query<{ name: string }>('SELECT name FROM netlify.migrations ORDER BY name')
  expect(tracking.rows).toHaveLength(1)
  expect(tracking.rows[0].name).toBe('0001_create_users')

  // users table should exist
  const usersResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'users'")
  expect(usersResult.rows).toHaveLength(1)

  // posts table should NOT exist (migration 3 was never reached)
  const postsResult = await pgDb.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'")
  expect(postsResult.rows).toHaveLength(0)
})

test('Ignores non-matching entries (.DS_Store, readme.md, etc.)', async () => {
  tmpDir = await tmp.dir()

  // Create valid migration
  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)')

  // Create non-matching entries
  await fs.writeFile(join(tmpDir.path, '.DS_Store'), '')
  await fs.writeFile(join(tmpDir.path, 'readme.md'), '# Migrations')
  await fs.mkdir(join(tmpDir.path, 'not_a_migration'))

  db = await PGlite.create()

  const applied = await applyMigrations(db, tmpDir.path, '0001_create_users')

  expect(applied).toHaveLength(1)
  expect(applied[0]).toBe('0001_create_users')
})

test('Lexicographic ordering with timestamp-style prefixes', async () => {
  const { migrationsDir, db: pgDb } = await setupMigrations([
    { name: '1709312400_add_comments', sql: 'CREATE TABLE comments (id SERIAL PRIMARY KEY, body TEXT)' },
    { name: '0001_create_users', sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)' },
    { name: '0002_add_posts', sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)' },
  ])

  const applied = await applyMigrations(pgDb, migrationsDir, '1709312400_add_comments')

  // Lexicographic sort: 0001, 0002, 1709312400
  expect(applied).toHaveLength(3)
  expect(applied[0]).toBe('0001_create_users')
  expect(applied[1]).toBe('0002_add_posts')
  expect(applied[2]).toBe('1709312400_add_comments')
})

test('Applies flat .sql file migrations', async () => {
  tmpDir = await tmp.dir()

  await createFlatMigration(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)')
  await createFlatMigration(tmpDir.path, '0002_add_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)')

  db = await PGlite.create()

  const applied = await applyMigrations(db, tmpDir.path)

  expect(applied).toEqual(['0001_create_users', '0002_add_posts'])

  const usersResult = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'users'")
  expect(usersResult.rows).toHaveLength(1)

  const postsResult = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'")
  expect(postsResult.rows).toHaveLength(1)
})

test('Applies a mix of directory and flat-file migrations in lexicographic order', async () => {
  tmpDir = await tmp.dir()

  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)')
  await createFlatMigration(tmpDir.path, '0002_add_posts', 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT)')
  await createMigrationDir(tmpDir.path, '0003_add_comments', 'CREATE TABLE comments (id SERIAL PRIMARY KEY, body TEXT)')

  db = await PGlite.create()

  const applied = await applyMigrations(db, tmpDir.path)

  expect(applied).toEqual(['0001_create_users', '0002_add_posts', '0003_add_comments'])
})

test('Throws when a directory and flat file share the same name', async () => {
  tmpDir = await tmp.dir()

  await createMigrationDir(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await createFlatMigration(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY)')

  db = await PGlite.create()

  await expect(applyMigrations(db, tmpDir.path)).rejects.toThrow(/Duplicate migration name "0001_create_users"/)
})

test('Ignores flat .sql files whose name does not match the migration pattern', async () => {
  tmpDir = await tmp.dir()

  await createFlatMigration(tmpDir.path, '0001_create_users', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)')
  // None of these should be picked up.
  await fs.writeFile(join(tmpDir.path, 'seed.sql'), 'SELECT 1')
  await fs.writeFile(join(tmpDir.path, 'readme.sql'), 'SELECT 1')

  db = await PGlite.create()

  const applied = await applyMigrations(db, tmpDir.path)

  expect(applied).toEqual(['0001_create_users'])
})
