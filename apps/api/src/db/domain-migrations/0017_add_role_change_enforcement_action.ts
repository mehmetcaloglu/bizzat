import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table account_enforcements
      drop constraint if exists account_enforcements_action_check;

    alter table account_enforcements
      add constraint account_enforcements_action_check check (
        action in (
          'warning', 'suspend', 'ban', 'reactivate', 'listing_takedown', 'role_change'
        )
      );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table account_enforcements
      drop constraint if exists account_enforcements_action_check;

    alter table account_enforcements
      add constraint account_enforcements_action_check check (
        action in ('warning', 'suspend', 'ban', 'reactivate', 'listing_takedown')
      );
  `.execute(db)
}
