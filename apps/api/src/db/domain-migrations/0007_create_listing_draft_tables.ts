import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table listing_types (
      id uuid primary key default uuidv7(),
      code text not null unique,
      created_at timestamptz not null default now()
    );

    insert into listing_types (code)
    values ('car_sale')
    on conflict (code) do nothing;

    create table listings (
      id uuid primary key default uuidv7(),
      owner_user_id uuid not null references auth."user"(id) on delete cascade,
      listing_type_id uuid not null references listing_types(id),
      status text not null default 'draft',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint listings_status_check check (
        status in (
          'draft',
          'pending_verification',
          'pending_review',
          'published',
          'rejected',
          'inactive'
        )
      )
    );

    create table car_details (
      listing_id uuid primary key references listings(id) on delete cascade,
      vehicle_model_id uuid not null references vehicle_models(id)
    );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists car_details;
    drop table if exists listings;
    drop table if exists listing_types;
  `.execute(db)
}
