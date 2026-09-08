import { getMigrations } from 'better-auth/db/migration'
import type { BizzatAuth } from './auth.js'

export async function migrateAuth(auth: BizzatAuth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
