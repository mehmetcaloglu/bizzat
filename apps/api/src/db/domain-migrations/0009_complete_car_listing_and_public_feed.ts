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
      add column vehicle_condition text,
      add column engine_power_hp smallint,
      add column engine_displacement_cc integer,
      add column drivetrain text,
      add column color text,
      add column under_warranty boolean,
      add column heavy_damage_recorded boolean,
      add column plate_nationality text,
      add column swap_available boolean,
      add column paint_status text,
      add column replacement_status text,
      add constraint car_details_fuel_type_check check (
        fuel_type is null or fuel_type in ('benzin', 'dizel', 'lpg', 'hibrit', 'elektrik')
      ),
      add constraint car_details_transmission_check check (
        transmission is null or transmission in ('manuel', 'otomatik', 'yari_otomatik')
      ),
      add constraint car_details_body_type_check check (
        body_type is null or body_type in ('hatchback', 'sedan', 'station_wagon', 'suv', 'coupe', 'cabrio', 'mpv', 'roadster', 'diger')
      ),
      add constraint car_details_vehicle_condition_check check (
        vehicle_condition is null or vehicle_condition in ('second_hand', 'imported_new', 'new')
      ),
      add constraint car_details_engine_power_check check (
        engine_power_hp is null or engine_power_hp between 1 and 2000
      ),
      add constraint car_details_engine_displacement_check check (
        engine_displacement_cc is null or engine_displacement_cc between 1 and 20000
      ),
      add constraint car_details_drivetrain_check check (
        drivetrain is null or drivetrain in ('front', 'rear', 'four_wd', 'awd')
      ),
      add constraint car_details_plate_nationality_check check (
        plate_nationality is null or plate_nationality in ('tr', 'ma')
      ),
      add constraint car_details_paint_status_check check (
        paint_status is null or paint_status in ('original', 'partial', 'painted')
      ),
      add constraint car_details_replacement_status_check check (
        replacement_status is null or replacement_status in ('none', 'replaced')
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
      drop constraint if exists car_details_replacement_status_check,
      drop constraint if exists car_details_paint_status_check,
      drop constraint if exists car_details_plate_nationality_check,
      drop constraint if exists car_details_drivetrain_check,
      drop constraint if exists car_details_engine_displacement_check,
      drop constraint if exists car_details_engine_power_check,
      drop constraint if exists car_details_vehicle_condition_check,
      drop constraint if exists car_details_body_type_check,
      drop constraint if exists car_details_transmission_check,
      drop constraint if exists car_details_fuel_type_check,
      drop column if exists replacement_status,
      drop column if exists paint_status,
      drop column if exists swap_available,
      drop column if exists plate_nationality,
      drop column if exists heavy_damage_recorded,
      drop column if exists under_warranty,
      drop column if exists color,
      drop column if exists drivetrain,
      drop column if exists engine_displacement_cc,
      drop column if exists engine_power_hp,
      drop column if exists vehicle_condition,
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
