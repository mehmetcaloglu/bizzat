import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table vehicle_models
      add column selection_path jsonb,
      add constraint vehicle_models_selection_path_check check (
        selection_path is null
        or (
          jsonb_typeof(selection_path) = 'array'
          and jsonb_array_length(selection_path) > 0
        )
      );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table vehicle_models
      drop constraint if exists vehicle_models_selection_path_check,
      drop column if exists selection_path;
  `.execute(db)
}
