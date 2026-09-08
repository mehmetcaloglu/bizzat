import { sql, type Kysely } from 'kysely'
import type { Database } from './client.js'

export async function checkDatabase(db: Kysely<Database>): Promise<void> {
  await sql`select 1`.execute(db)
}
