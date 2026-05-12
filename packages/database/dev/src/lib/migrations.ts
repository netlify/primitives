import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Dirent } from 'node:fs'

import type { SQLExecutor } from './sql-executor.js'

const MIGRATION_NAME_PATTERN = /^\d+_.+$/
const MIGRATION_FILE = 'migration.sql'
const SQL_EXTENSION = '.sql'
const TRACKING_SCHEMA = 'netlify'
const TRACKING_TABLE = `${TRACKING_SCHEMA}.migrations`

interface Migration {
  name: string
  sqlPath: string
}

// Maps a directory entry to a Migration, or null if it isn't one. Supports
// both directory-style migrations (`<prefix>_<slug>/migration.sql`) and flat
// file migrations (`<prefix>_<slug>.sql`).
function toMigration(entry: Dirent, migrationsDirectory: string): Migration | null {
  if (entry.isDirectory()) {
    if (!MIGRATION_NAME_PATTERN.test(entry.name)) {
      return null
    }

    return {
      name: entry.name,
      sqlPath: join(migrationsDirectory, entry.name, MIGRATION_FILE),
    }
  }

  if (entry.isFile() && entry.name.endsWith(SQL_EXTENSION)) {
    const name = entry.name.slice(0, -SQL_EXTENSION.length)

    if (!MIGRATION_NAME_PATTERN.test(name)) {
      return null
    }

    return {
      name,
      sqlPath: join(migrationsDirectory, entry.name),
    }
  }

  return null
}

// Creates the migrations tracking table if it doesn't already exist. It's
// idempotent.
export async function initializeTrackingTable(db: SQLExecutor): Promise<void> {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS ${TRACKING_SCHEMA};
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function applyMigrations(
  db: SQLExecutor,
  migrationsDirectory: string,
  target?: string,
): Promise<string[]> {
  await initializeTrackingTable(db)

  let migrations: Migration[]

  try {
    const dirents = await readdir(migrationsDirectory, { withFileTypes: true })
    migrations = dirents
      .map((entry) => toMigration(entry, migrationsDirectory))
      .filter((m): m is Migration => m !== null)
  } catch {
    throw new Error(`Migration directory not found: ${migrationsDirectory}`)
  }

  const seen = new Map<string, string>()
  for (const migration of migrations) {
    const existing = seen.get(migration.name)
    if (existing) {
      throw new Error(
        `Duplicate migration name "${migration.name}" in ${migrationsDirectory}: ` +
          `found both "${existing}" and "${migration.sqlPath}". Remove one before applying migrations.`,
      )
    }
    seen.set(migration.name, migration.sqlPath)
  }

  migrations.sort((a, b) => a.name.localeCompare(b.name))

  let migrationsToConsider: Migration[]

  if (target === undefined) {
    migrationsToConsider = migrations
  } else {
    // Resolve target — exact match first, then prefix match.
    let targetIndex = migrations.findIndex((m) => m.name === target)

    if (targetIndex === -1) {
      targetIndex = migrations.findIndex((m) => m.name.startsWith(`${target}_`))
    }

    if (targetIndex === -1) {
      throw new Error(`No migration found matching target: ${target}`)
    }

    migrationsToConsider = migrations.slice(0, targetIndex + 1)
  }

  const names = migrationsToConsider.map((m) => m.name)
  const result = await db.query<{ name: string }>(`SELECT name FROM ${TRACKING_TABLE} WHERE name = ANY($1)`, [names])
  const alreadyApplied = new Set(result.rows.map((row) => row.name))

  const applied: string[] = []

  for (const migration of migrationsToConsider) {
    if (alreadyApplied.has(migration.name)) {
      continue
    }

    let sql: string

    try {
      sql = await readFile(migration.sqlPath, 'utf-8')
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        throw new Error(`Migration SQL file not found: ${migration.sqlPath}`)
      }

      throw new Error(`Failed to read migration "${migration.name}" at "${migration.sqlPath}": ${err.message}`)
    }

    await db.transaction(async (tx) => {
      await tx.exec(sql)
      await tx.query(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [migration.name])
    })

    applied.push(migration.name)
  }

  return applied
}
