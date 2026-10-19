import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table listings
      add column title text,
      add column contact_phone_e164 text,
      add column show_phone boolean not null default false,
      add constraint listings_title_length_check check (
        title is null or char_length(title) between 10 and 120
      ),
      add constraint listings_contact_phone_check check (
        contact_phone_e164 is null or contact_phone_e164 ~ '^\\+90[0-9]{10}$'
      );

    alter table car_details
      add column fuel_type text,
      add column transmission text,
      add column body_type text,
      add column color text,
      add constraint car_details_fuel_type_check check (
        fuel_type is null or fuel_type in ('benzin', 'dizel', 'lpg', 'hibrit', 'elektrik')
      ),
      add constraint car_details_transmission_check check (
        transmission is null or transmission in ('manuel', 'otomatik', 'yari_otomatik')
      ),
      add constraint car_details_body_type_check check (
        body_type is null or body_type in ('hatchback', 'sedan', 'station_wagon', 'suv', 'coupe', 'cabrio', 'mpv', 'diger')
      ),
      add constraint car_details_color_length_check check (
        color is null or char_length(color) between 2 and 40
      );

    create table listing_images (
      id uuid primary key default uuidv7(),
      listing_id uuid not null references listings(id) on delete cascade,
      storage_key text not null unique,
      sort_order integer not null default 0,
      mime_type text not null,
      size_bytes integer not null,
      created_at timestamptz not null default now(),
      constraint listing_images_sort_order_check check (sort_order >= 0),
      constraint listing_images_size_check check (size_bytes > 0 and size_bytes <= 8000000),
      constraint listing_images_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp'))
    );

    create index listing_images_listing_sort_idx
      on listing_images (listing_id, sort_order, created_at);
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists listing_images;

    alter table car_details
      drop constraint if exists car_details_color_length_check,
      drop constraint if exists car_details_body_type_check,
      drop constraint if exists car_details_transmission_check,
      drop constraint if exists car_details_fuel_type_check,
      drop column if exists color,
      drop column if exists body_type,
      drop column if exists transmission,
      drop column if exists fuel_type;

    alter table listings
      drop constraint if exists listings_contact_phone_check,
      drop constraint if exists listings_title_length_check,
      drop column if exists show_phone,
      drop column if exists contact_phone_e164,
      drop column if exists title;
  `.execute(db)
}
