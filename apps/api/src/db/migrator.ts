import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Kysely } from 'kysely'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import type { Database } from './client.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const bootstrapMigrationFolder = path.join(root, 'migrations')
const domainMigrationFolder = path.join(root, 'domain-migrations')

async function runMigrator(
  db: Kysely<Database>,
  migrationFolder: string,
  migrationTableName?: string,
  migrationLockTableName?: string,
): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
    ...(migrationTableName ? { migrationTableName } : {}),
    ...(migrationLockTableName ? { migrationLockTableName } : {}),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`Migration failed: ${result.migrationName}`)
    }
  }

  if (error) throw error
}

export async function migrateBootstrap(db: Kysely<Database>): Promise<void> {
  await runMigrator(db, bootstrapMigrationFolder)
}

export async function migrateDomain(db: Kysely<Database>): Promise<void> {
  await runMigrator(
    db,
    domainMigrationFolder,
    'bizzat_domain_migration',
    'bizzat_domain_migration_lock',
  )
}

// Backward-compatible name for foundation tests and callers that only need
// the pre-auth bootstrap phase.
export const migrateToLatest = migrateBootstrap
