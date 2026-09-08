import type { Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema.createSchema('auth').ifNotExists().execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropSchema('auth').ifExists().cascade().execute()
}
