import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table if not exists reference_data_providers (
      id uuid primary key default uuidv7(),
      code text not null unique,
      source_name text not null,
      source_url text,
      license text,
      created_at timestamptz not null default now()
    );

    create table if not exists reference_data_imports (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references reference_data_providers(id) on delete cascade,
      version text not null,
      checksum_sha256 text not null,
      imported_at timestamptz not null default now(),
      unique (provider_id, version, checksum_sha256)
    );

    create table if not exists provinces (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references reference_data_providers(id) on delete cascade,
      source_key text not null,
      code text not null,
      name text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider_id, source_key)
    );

    create unique index if not exists provinces_active_code_uidx
      on provinces(code)
      where active = true;

    create index if not exists provinces_active_code_name_idx
      on provinces(active, code, name);

    create table if not exists districts (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references reference_data_providers(id) on delete cascade,
      source_key text not null,
      province_id uuid not null references provinces(id),
      name text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider_id, source_key)
    );

    create index if not exists districts_province_active_name_idx
      on districts(province_id, active, name);

    create table if not exists neighborhoods (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references reference_data_providers(id) on delete cascade,
      source_key text not null,
      district_id uuid not null references districts(id),
      name text not null,
      kind text,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider_id, source_key)
    );

    create index if not exists neighborhoods_district_active_name_idx
      on neighborhoods(district_id, active, name);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('neighborhoods').ifExists().execute()
  await db.schema.dropTable('districts').ifExists().execute()
  await db.schema.dropTable('provinces').ifExists().execute()
  await db.schema.dropTable('reference_data_imports').ifExists().execute()
  await db.schema.dropTable('reference_data_providers').ifExists().execute()
}
