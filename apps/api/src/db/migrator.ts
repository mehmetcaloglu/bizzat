import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Kysely } from 'kysely'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import type { Database } from './client.js'

const migrationFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`Migration failed: ${result.migrationName}`)
    }
  }

  if (error) throw error
}
