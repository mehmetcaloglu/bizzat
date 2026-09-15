import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table listings
      add column description text,
      add column price_amount numeric(16, 2),
      add column currency char(3),
      add column province_id uuid references provinces(id),
      add column district_id uuid references districts(id),
      add column neighborhood_id uuid references neighborhoods(id),
      add constraint listings_price_amount_check check (
        price_amount is null or price_amount > 0
      ),
      add constraint listings_currency_check check (
        currency is null or currency = 'TRY'
      ),
      add constraint listings_description_length_check check (
        description is null or char_length(description) <= 5000
      );

    alter table car_details
      add column model_year smallint,
      add column mileage_km integer,
      add constraint car_details_model_year_check check (
        model_year is null or model_year between 1900 and 2100
      ),
      add constraint car_details_mileage_km_check check (
        mileage_km is null or mileage_km >= 0
      );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table car_details
      drop constraint if exists car_details_mileage_km_check,
      drop constraint if exists car_details_model_year_check,
      drop column if exists mileage_km,
      drop column if exists model_year;

    alter table listings
      drop constraint if exists listings_description_length_check,
      drop constraint if exists listings_currency_check,
      drop constraint if exists listings_price_amount_check,
      drop column if exists neighborhood_id,
      drop column if exists district_id,
      drop column if exists province_id,
      drop column if exists currency,
      drop column if exists price_amount,
      drop column if exists description;
  `.execute(db)
}
