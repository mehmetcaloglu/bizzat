import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table if not exists vehicle_brands (
      id uuid primary key default uuidv7(),
      catalog_key text not null unique,
      name text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists vehicle_brands_active_name_idx
      on vehicle_brands(active, name);

    create table if not exists vehicle_series (
      id uuid primary key default uuidv7(),
      brand_id uuid not null references vehicle_brands(id),
      catalog_key text not null unique,
      name text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists vehicle_series_brand_active_name_idx
      on vehicle_series(brand_id, active, name);

    create table if not exists vehicle_models (
      id uuid primary key default uuidv7(),
      series_id uuid not null references vehicle_series(id),
      catalog_key text not null unique,
      name text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists vehicle_models_series_active_name_idx
      on vehicle_models(series_id, active, name);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('vehicle_models').ifExists().execute()
  await db.schema.dropTable('vehicle_series').ifExists().execute()
  await db.schema.dropTable('vehicle_brands').ifExists().execute()
}
