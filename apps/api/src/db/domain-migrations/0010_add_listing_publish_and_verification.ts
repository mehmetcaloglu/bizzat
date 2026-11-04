import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table listings
      add column published_at timestamptz;

    create table verification_checks (
      id uuid primary key default uuidv7(),
      listing_id uuid not null references listings(id) on delete cascade,
      type text not null,
      provider text not null,
      status text not null,
      provider_reference text,
      failure_code text,
      verified_at timestamptz,
      created_at timestamptz not null default now(),
      constraint verification_checks_type_check check (
        type in ('vehicle_authority')
      ),
      constraint verification_checks_status_check check (
        status in ('pending', 'verified', 'failed', 'unavailable')
      ),
      constraint verification_checks_verified_at_check check (
        (status = 'verified' and verified_at is not null)
        or (status <> 'verified' and verified_at is null)
      )
    );

    create index verification_checks_listing_created_idx
      on verification_checks (listing_id, created_at desc);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists verification_checks;
    alter table listings drop column if exists published_at;
  `.execute(db)
}
