import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Dirent } from 'node:fs'

import type { PGlite, Transaction } from '@electric-sql/pglite'

const MIGRATION_DIR_PATTERN = /^\d+_.+$/
const MIGRATION_FILE = 'migration.sql'
const TRACKING_TABLE = 'netlify_migrations'

function isMigrationDirectory(entry: Dirent): boolean {
  return entry.isDirectory() && MIGRATION_DIR_PATTERN.test(entry.name)
}

export async function applyMigrations(db: PGlite, migrationsDirectory: string, target?: string): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Discover migration directories.
  let entries: string[]

  try {
    const dirents = await readdir(migrationsDirectory, { withFileTypes: true })
    entries = dirents.filter(isMigrationDirectory).map((d) => d.name)
  } catch {
    throw new Error(`Migration directory not found: ${migrationsDirectory}`)
  }

  entries.sort()

  let migrationsToConsider: string[]

  if (target === undefined) {
    // No target specified — apply all discovered migrations.
    migrationsToConsider = entries
  } else {
    // Resolve target — exact match first, then prefix match.
    let targetIndex = entries.indexOf(target)

    if (targetIndex === -1) {
      targetIndex = entries.findIndex((name) => name.startsWith(`${target}_`))
    }

    if (targetIndex === -1) {
      throw new Error(`No migration found matching target: ${target}`)
    }

    migrationsToConsider = entries.slice(0, targetIndex + 1)
  }

  // Find already-applied migrations.
  const result = await db.query<{ name: string }>(`SELECT name FROM ${TRACKING_TABLE} WHERE name = ANY($1)`, [
    migrationsToConsider,
  ])
  const alreadyApplied = new Set(result.rows.map((row) => row.name))

  const applied: string[] = []

  for (const name of migrationsToConsider) {
    if (alreadyApplied.has(name)) {
      continue
    }

    const sqlPath = join(migrationsDirectory, name, MIGRATION_FILE)
    let sql: string

    try {
      sql = await readFile(sqlPath, 'utf-8')
    } catch {
      throw new Error(`${MIGRATION_FILE} not found in migration directory: ${name}`)
    }

    await db.transaction(async (tx: Transaction) => {
      await tx.exec(sql)
      await tx.query(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [name])
    })

    applied.push(name)
  }

  return applied
}
