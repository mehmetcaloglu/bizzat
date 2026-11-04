import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table reports (
      id uuid primary key default uuidv7(),
      listing_id uuid not null references listings(id) on delete cascade,
      reporter_user_id uuid references auth."user"(id) on delete set null,
      reason text not null,
      note text,
      status text not null default 'open',
      reviewed_by_user_id uuid references auth."user"(id) on delete set null,
      reviewed_at timestamptz,
      resolution_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint reports_reason_check check (
        reason in (
          'fraud',
          'wrong_category',
          'prohibited',
          'duplicate',
          'misleading',
          'other'
        )
      ),
      constraint reports_status_check check (
        status in ('open', 'reviewing', 'resolved', 'dismissed')
      ),
      constraint reports_note_length_check check (
        note is null or char_length(note) <= 1000
      ),
      constraint reports_resolution_note_length_check check (
        resolution_note is null or char_length(resolution_note) <= 2000
      ),
      constraint reports_review_state_check check (
        (status in ('open', 'reviewing') and reviewed_at is null)
        or (status in ('resolved', 'dismissed') and reviewed_at is not null)
      )
    );

    create index reports_status_created_idx
      on reports (status, created_at desc);

    create index reports_listing_status_idx
      on reports (listing_id, status);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists reports;
  `.execute(db)
}
