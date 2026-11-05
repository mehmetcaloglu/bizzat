import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table reports
      add column reporter_ip_hash text;

    alter table reports
      add constraint reports_reporter_ip_hash_check check (
        reporter_ip_hash is null or char_length(reporter_ip_hash) = 64
      );

    create index reports_reporter_user_created_idx
      on reports (reporter_user_id, created_at desc)
      where reporter_user_id is not null;

    create index reports_reporter_ip_created_idx
      on reports (reporter_ip_hash, created_at desc)
      where reporter_ip_hash is not null;
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop index if exists reports_reporter_ip_created_idx;
    drop index if exists reports_reporter_user_created_idx;

    alter table reports
      drop constraint if exists reports_reporter_ip_hash_check;

    alter table reports
      drop column if exists reporter_ip_hash;
  `.execute(db)
}
