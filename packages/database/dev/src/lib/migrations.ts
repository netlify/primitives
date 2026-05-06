import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Dirent } from 'node:fs'

import type { SQLExecutor } from './sql-executor.js'

const MIGRATION_NAME_PATTERN = /^(\d+)_.+$/
const MIGRATION_FILE = 'migration.sql'
const SQL_EXTENSION = '.sql'
const TRACKING_SCHEMA = 'netlify'
const TRACKING_TABLE = `${TRACKING_SCHEMA}.migrations`

export interface Migration {
  name: string
  version: number
  sqlPath: string
}

function nameAndFileToMigration(name: string, sqlPath: string): Migration | null {
  const match = MIGRATION_NAME_PATTERN.exec(name)
  if (!match) {
    return null
  }

  return {
    name,
    version: parseInt(match[1], 10),
    sqlPath,
  }
}

// Maps a directory entry to a Migration, or null if it isn't one. Supports
// both directory-style migrations (`<prefix>_<slug>/migration.sql`) and flat
// file migrations (`<prefix>_<slug>.sql`).
function direntToMigration(entry: Dirent, migrationsDirectory: string): Migration | null {
  if (entry.isDirectory()) {
    return nameAndFileToMigration(entry.name, join(migrationsDirectory, entry.name, MIGRATION_FILE))
  }

  if (entry.isFile() && entry.name.endsWith(SQL_EXTENSION)) {
    const name = entry.name.slice(0, -SQL_EXTENSION.length)
    return nameAndFileToMigration(name, join(migrationsDirectory, entry.name))
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

export class MissingMigrationDirectoryError extends Error {
  public readonly migrationsDirectory: string
  constructor(options: ErrorOptions & { migrationsDirectory: string }) {
    super(`Migration directory not found: ${options.migrationsDirectory}`, { cause: options.cause })
    this.name = 'MissingMigrationDirectoryError'
    this.migrationsDirectory = options.migrationsDirectory
  }
}

export class DuplicateMigrationVersionsError extends Error {
  public readonly versionsWithMultipleMigrations: Record<number, Migration[]>
  constructor(options: { versionsWithMultipleMigrations: Map<number, Set<Migration>> }) {
    const versionsWithMultipleMigrationsObject = Object.fromEntries(
      Array.from(options.versionsWithMultipleMigrations.entries()).map(([version, migrations]) => [
        version,
        Array.from(migrations),
      ]),
    )

    const duplicateVersionsDetails = Object.entries(versionsWithMultipleMigrationsObject)
      .map(([version, migrations]) => {
        return ` - Version ${version}:\n${migrations.map((m) => `   - ${m.sqlPath}`).join('\n')}`
      })
      .join('\n')

    super(`Duplicate migration versions found:\n${duplicateVersionsDetails}`)
    this.name = 'DuplicateMigrationVersionError'
    this.versionsWithMultipleMigrations = versionsWithMultipleMigrationsObject
  }
}

export class MigrationsApplyError extends Error {
  public readonly appliedMigrations: Migration[]
  public readonly migrationCausingError: Migration
  public readonly remainingMigrations: Migration[]
  public readonly cause: Error
  constructor(options: {
    appliedMigrations: Migration[]
    migrationCausingError: Migration
    remainingMigrations: Migration[]
    cause: unknown
  }) {
    super(`Failed to apply migrations`, { cause: options.cause })
    this.name = 'MigrationsApplyError'
    this.appliedMigrations = options.appliedMigrations
    this.migrationCausingError = options.migrationCausingError
    this.remainingMigrations = options.remainingMigrations
    this.cause = options.cause instanceof Error ? options.cause : new Error(String(options.cause))
  }
}

export async function applyMigrations(...args: Parameters<typeof applyMigrationsWithDetails>): Promise<string[]> {
  const migrations = await applyMigrationsWithDetails(...args)
  return migrations.map((m) => m.name)
}

export async function applyMigrationsWithDetails(
  db: SQLExecutor,
  migrationsDirectory: string,
  target?: string,
): Promise<Migration[]> {
  await initializeTrackingTable(db)

  let migrations: Migration[]

  try {
    const dirents = await readdir(migrationsDirectory, { withFileTypes: true })
    migrations = dirents
      .map((entry) => direntToMigration(entry, migrationsDirectory))
      .filter((m): m is Migration => m !== null)
  } catch (error) {
    throw new MissingMigrationDirectoryError({ migrationsDirectory, cause: error })
  }

  const seenVersions = new Map<number, Set<Migration>>()
  const versionsWithMultipleMigrations = new Map<number, Set<Migration>>()
  for (const migration of migrations) {
    let existingVersions = seenVersions.get(migration.version)
    if (!existingVersions) {
      existingVersions = new Set()
      seenVersions.set(migration.version, existingVersions)
    }
    if (existingVersions.size === 1) {
      versionsWithMultipleMigrations.set(migration.version, existingVersions)
    }
    existingVersions.add(migration)
  }

  if (versionsWithMultipleMigrations.size > 0) {
    throw new DuplicateMigrationVersionsError({ versionsWithMultipleMigrations })
  }

  migrations.sort((a, b) => a.version - b.version)

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

  const applied: Migration[] = []

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

    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql)
        await tx.query(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [migration.name])
      })
    } catch (error) {
      throw new MigrationsApplyError({
        cause: error,
        appliedMigrations: applied,
        migrationCausingError: migration,
        remainingMigrations: migrationsToConsider.slice(applied.length + 1),
      })
    }

    applied.push(migration)
  }

  return applied
}
