import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table if not exists profiles (
      user_id uuid primary key references auth."user"(id) on delete cascade,
      role text not null default 'user',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint profiles_role_check check (role in ('user', 'moderator', 'admin'))
    )
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('profiles').ifExists().execute()
}
