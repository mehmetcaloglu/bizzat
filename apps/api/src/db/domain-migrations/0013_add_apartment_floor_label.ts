import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table apartment_details
      add column floor_label text;

    alter table apartment_details
      add constraint apartment_details_floor_label_check check (
        floor_label is null or floor_label in (
          'garden', 'basement', 'ground', 'entrance', 'high_entrance',
          'detached', 'villa', 'attic'
        )
      );

    alter table apartment_details
      add constraint apartment_details_floor_exclusive_check check (
        floor is null or floor_label is null
      );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table apartment_details
      drop constraint if exists apartment_details_floor_exclusive_check;

    alter table apartment_details
      drop constraint if exists apartment_details_floor_label_check;

    alter table apartment_details
      drop column if exists floor_label;
  `.execute(db)
}
