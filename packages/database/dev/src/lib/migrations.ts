import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Dirent } from 'node:fs'

import type { SQLExecutor } from './sql-executor.js'

const MIGRATION_NAME_PATTERN = /^(\d+)_[a-z0-9_-]+$/
const MIGRATION_FILE = 'migration.sql'
const SQL_EXTENSION = '.sql'
const TRACKING_SCHEMA = 'netlify'
const TRACKING_TABLE = `${TRACKING_SCHEMA}.migrations`

export interface Migration {
  name: string
  version: number
  sqlPath: string
}

export interface PgErrorDetails {
  message: string
  code?: string
  position?: number
  hint?: string
  detail?: string
  severity?: string
}

export type MigrationIssue =
  | {
      kind: 'duplicate-name'
      version: number
      name: string
      files: Migration[]
      summary: string
      remediation: string
    }
  | {
      kind: 'duplicate-version'
      version: number
      files: Migration[]
      summary: string
      remediation: string
    }
  | {
      kind: 'apply-failure'
      migration: Migration
      appliedBefore: Migration[]
      remaining: Migration[]
      pgError: PgErrorDetails
      summary: string
      remediation: string
    }
  | {
      kind: 'migration-file-error'
      reason: 'missing' | 'unreadable'
      migrationName: string
      sqlPath: string
      summary: string
      remediation: string
      cause?: unknown
    }
  | {
      kind: 'unknown'
      summary: string
      remediation: string
      cause?: unknown
    }

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const parseOptionalInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = parseInt(value, 10)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function normalizePgError(error: unknown): PgErrorDetails {
  if (!(error instanceof Error)) {
    return { message: String(error) }
  }
  const e = error as Error & Record<string, unknown>
  return {
    message: e.message,
    code: optionalString(e.code),
    position: parseOptionalInt(e.position),
    hint: optionalString(e.hint),
    detail: optionalString(e.detail),
    severity: optionalString(e.severity),
  }
}

const buildDuplicateNameIssue = (version: number, name: string, files: Migration[]): MigrationIssue => ({
  kind: 'duplicate-name',
  version,
  name,
  files,
  summary: `Two or more migrations share the name "${name}".`,
  remediation: `Delete one of the duplicate files before applying.`,
})

const buildDuplicateVersionIssue = (version: number, files: Migration[]): MigrationIssue => {
  const fileList = files.map((m) => `"${m.name}"`).join(', ')
  return {
    kind: 'duplicate-version',
    version,
    files,
    summary: `Version ${String(version)} is used by multiple migrations: ${fileList}.`,
    remediation: `Increment one of the prefixes so ordering is unambiguous, or delete a file if it was an unintended duplicate.`,
  }
}

const buildApplyFailureIssue = (options: {
  migration: Migration
  appliedBefore: Migration[]
  remaining: Migration[]
  cause: unknown
}): MigrationIssue & { kind: 'apply-failure' } => {
  const pgError = normalizePgError(options.cause)
  const codeNote = pgError.code ? ` Postgres returned SQLSTATE ${pgError.code}; look that up for common causes.` : ''
  return {
    kind: 'apply-failure',
    migration: options.migration,
    appliedBefore: options.appliedBefore,
    remaining: options.remaining,
    pgError,
    summary: `Migration "${options.migration.name}" failed to apply: ${pgError.message}`,
    remediation:
      `This may be a problem in the SQL of "${options.migration.name}" itself (for example, a syntax error), ` +
      `or in the cumulative database state left by previously applied migrations ` +
      `(for example, the migration tries to create an object that an earlier migration already created, ` +
      `or references one that was never created).${codeNote} ` +
      `Resolve the issue in the failing migration or in the prior ones before deploying.`,
  }
}

const buildMigrationFileIssue = (options: {
  migrationName: string
  sqlPath: string
  reason: 'missing' | 'unreadable'
  cause?: unknown
}): MigrationIssue & { kind: 'migration-file-error' } => {
  if (options.reason === 'missing') {
    return {
      kind: 'migration-file-error',
      reason: 'missing',
      migrationName: options.migrationName,
      sqlPath: options.sqlPath,
      summary: `Migration "${options.migrationName}" is missing its SQL file at ${options.sqlPath}.`,
      remediation: `Create the file at ${options.sqlPath}, or remove the migration's directory if it isn't intended.`,
      cause: options.cause,
    }
  }
  const causeMessage = options.cause instanceof Error ? options.cause.message : String(options.cause)
  return {
    kind: 'migration-file-error',
    reason: 'unreadable',
    migrationName: options.migrationName,
    sqlPath: options.sqlPath,
    summary: `Could not read migration "${options.migrationName}" at ${options.sqlPath}: ${causeMessage}`,
    remediation: `Check filesystem permissions on ${options.sqlPath} and that it isn't held open by another process.`,
    cause: options.cause,
  }
}

const formatIssueAsErrorLine = (issue: MigrationIssue): string => {
  if (issue.kind === 'duplicate-name') {
    const paths = issue.files.map((m) => `   - ${m.sqlPath}`).join('\n')
    return ` - ${issue.summary} ${issue.remediation}\n${paths}`
  }
  if (issue.kind === 'duplicate-version') {
    const paths = issue.files.map((m) => `   - ${m.sqlPath} (${m.name})`).join('\n')
    return ` - ${issue.summary} ${issue.remediation}\n${paths}`
  }
  if (issue.kind === 'apply-failure' || issue.kind === 'migration-file-error') {
    return ` - ${issue.summary}\n   ${issue.remediation}`
  }
  return ` - ${issue.summary} ${issue.remediation}`
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
  public readonly issues: MigrationIssue[]
  public readonly migrationsDirectory: string
  constructor(options: { issues: MigrationIssue[]; migrationsDirectory: string }) {
    const detail = options.issues.map(formatIssueAsErrorLine).join('\n')
    super(`Duplicate migrations found in ${options.migrationsDirectory}:\n${detail}`)
    this.name = 'DuplicateMigrationVersionsError'
    this.issues = options.issues
    this.migrationsDirectory = options.migrationsDirectory
  }
}

export class MigrationsApplyError extends Error {
  public readonly issue: MigrationIssue & { kind: 'apply-failure' }
  public readonly cause: Error
  constructor(options: { issue: MigrationIssue & { kind: 'apply-failure' } }) {
    super(`${options.issue.summary}\n${options.issue.remediation}`, { cause: options.issue.pgError })
    this.name = 'MigrationsApplyError'
    this.issue = options.issue
    this.cause = new Error(options.issue.pgError.message)
  }
}

export class MigrationFileError extends Error {
  public readonly issue: MigrationIssue & { kind: 'migration-file-error' }
  constructor(options: { issue: MigrationIssue & { kind: 'migration-file-error' } }) {
    super(`${options.issue.summary}\n${options.issue.remediation}`, { cause: options.issue.cause })
    this.name = 'MigrationFileError'
    this.issue = options.issue
  }
}

export function errorToIssues(error: unknown): MigrationIssue[] {
  if (error instanceof MissingMigrationDirectoryError) {
    return []
  }
  if (error instanceof DuplicateMigrationVersionsError) {
    return error.issues
  }
  if (error instanceof MigrationsApplyError || error instanceof MigrationFileError) {
    return [error.issue]
  }

  const message = error instanceof Error ? error.message : String(error)
  return [
    {
      kind: 'unknown',
      summary: `An unexpected error occurred while validating migrations: ${message}`,
      remediation: `Re-run the command. If the problem persists, file a bug report with the error details above.`,
      cause: error,
    },
  ]
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

  const migrationsByVersion = new Map<number, Migration[]>()
  for (const migration of migrations) {
    const existing = migrationsByVersion.get(migration.version)
    if (existing) {
      existing.push(migration)
    } else {
      migrationsByVersion.set(migration.version, [migration])
    }
  }

  const issues: MigrationIssue[] = []
  for (const [version, migrationsForVersion] of migrationsByVersion) {
    if (migrationsForVersion.length < 2) continue

    const byName = new Map<string, Migration[]>()
    for (const m of migrationsForVersion) {
      const list = byName.get(m.name)
      if (list) {
        list.push(m)
      } else {
        byName.set(m.name, [m])
      }
    }

    for (const [name, migrationsWithName] of byName) {
      if (migrationsWithName.length >= 2) {
        issues.push(buildDuplicateNameIssue(version, name, migrationsWithName))
      }
    }

    if (byName.size >= 2) {
      const representatives = Array.from(byName.values()).map((migs) => migs[0])
      issues.push(buildDuplicateVersionIssue(version, representatives))
    }
  }

  if (issues.length > 0) {
    throw new DuplicateMigrationVersionsError({ issues, migrationsDirectory })
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

  const migrationsToApplyWithContent: { migration: Migration; sql: string }[] = []
  for (const migration of migrationsToConsider) {
    if (alreadyApplied.has(migration.name)) {
      continue
    }

    try {
      const sql = await readFile(migration.sqlPath, 'utf-8')
      migrationsToApplyWithContent.push({ migration, sql })
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      throw new MigrationFileError({
        issue: buildMigrationFileIssue({
          migrationName: migration.name,
          sqlPath: migration.sqlPath,
          reason: err.code === 'ENOENT' ? 'missing' : 'unreadable',
          cause: err,
        }),
      })
    }
  }

  const applied: Migration[] = []
  for (const { migration, sql } of migrationsToApplyWithContent) {
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql)
        await tx.query(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [migration.name])
      })
    } catch (error) {
      throw new MigrationsApplyError({
        issue: buildApplyFailureIssue({
          migration,
          appliedBefore: applied,
          remaining: migrationsToConsider.slice(applied.length + 1),
          cause: error,
        }),
      })
    }

    applied.push(migration)
  }

  return applied
}
