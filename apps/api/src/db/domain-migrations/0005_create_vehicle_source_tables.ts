import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    create table if not exists vehicle_source_providers (
      id uuid primary key default uuidv7(),
      code text not null unique,
      source_name text not null,
      source_url text null,
      license text null,
      created_at timestamptz not null default now()
    );

    create table if not exists vehicle_source_imports (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references vehicle_source_providers(id),
      version text not null,
      checksum_sha256 text not null,
      imported_at timestamptz not null default now(),
      unique(provider_id, version, checksum_sha256)
    );

    create table if not exists vehicle_source_records (
      id uuid primary key default uuidv7(),
      provider_id uuid not null references vehicle_source_providers(id),
      source_key text not null,
      brand_raw text not null,
      type_raw text not null,
      available_model_years integer[] not null,
      active boolean not null default true,
      mapping_needs_review boolean not null default false,
      first_seen_import_id uuid not null references vehicle_source_imports(id),
      last_seen_import_id uuid not null references vehicle_source_imports(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(provider_id, source_key)
    );

    create index if not exists vehicle_source_records_provider_active_idx
      on vehicle_source_records(provider_id, active);
    create index if not exists vehicle_source_records_provider_review_idx
      on vehicle_source_records(provider_id, mapping_needs_review);

    create table if not exists vehicle_source_mappings (
      source_record_id uuid primary key references vehicle_source_records(id),
      vehicle_model_id uuid not null references vehicle_models(id),
      mapping_method text not null check (
        mapping_method in ('manual', 'exact-rule', 'curated-import')
      ),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists vehicle_source_imports_provider_imported_idx
      on vehicle_source_imports(provider_id, imported_at desc);
    create index if not exists vehicle_source_mappings_model_idx
      on vehicle_source_mappings(vehicle_model_id);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('vehicle_source_mappings').ifExists().execute()
  await db.schema.dropTable('vehicle_source_records').ifExists().execute()
  await db.schema.dropTable('vehicle_source_imports').ifExists().execute()
  await db.schema.dropTable('vehicle_source_providers').ifExists().execute()
}
