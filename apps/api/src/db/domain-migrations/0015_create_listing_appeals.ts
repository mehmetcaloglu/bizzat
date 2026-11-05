import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table listing_appeals (
      id uuid primary key default uuidv7(),
      listing_id uuid not null unique references listings(id) on delete cascade,
      appellant_user_id uuid not null references auth."user"(id) on delete cascade,
      note text not null,
      status text not null default 'pending',
      reviewed_by_user_id uuid references auth."user"(id) on delete set null,
      reviewed_at timestamptz,
      resolution_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint listing_appeals_status_check check (
        status in ('pending', 'approved', 'rejected')
      ),
      constraint listing_appeals_note_length_check check (
        char_length(note) between 10 and 1000
      ),
      constraint listing_appeals_resolution_note_length_check check (
        resolution_note is null or char_length(resolution_note) <= 2000
      ),
      constraint listing_appeals_review_state_check check (
        (status = 'pending' and reviewed_at is null)
        or (status in ('approved', 'rejected') and reviewed_at is not null)
      )
    );

    create index listing_appeals_status_created_idx
      on listing_appeals (status, created_at asc);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists listing_appeals;
  `.execute(db)
}
