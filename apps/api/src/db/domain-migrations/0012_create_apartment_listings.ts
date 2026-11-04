import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    insert into listing_types (code)
    values ('apartment_sale'), ('apartment_rent')
    on conflict (code) do nothing;

    create table apartment_details (
      listing_id uuid primary key references listings(id) on delete cascade,
      transaction_type text not null,
      room_count text not null,
      gross_m2 integer not null,
      net_m2 integer,
      building_age integer,
      floor integer,
      total_floors integer,
      heating text not null,
      bathroom_count integer not null,
      kitchen text not null,
      balcony boolean not null default false,
      elevator boolean not null default false,
      parking text not null default 'none',
      furnished boolean not null default false,
      occupancy text not null default 'empty',
      in_site boolean not null default false,
      deed_status text not null,
      credit_eligible boolean,
      swap_available boolean,
      deposit_amount numeric(14, 2),
      constraint apartment_details_transaction_check check (
        transaction_type in ('sale', 'rent')
      ),
      constraint apartment_details_room_count_check check (
        room_count in (
          'studio', '1+0', '1+1', '1.5+1', '2+0', '2+1', '2.5+1', '2+2',
          '3+0', '3+1', '3.5+1', '3+2', '4+0', '4+1', '4.5+1', '4+2',
          '5+1', '5+2', '6+1', '7+1', '8+1', '9+1', '10+'
        )
      ),
      constraint apartment_details_gross_m2_check check (
        gross_m2 between 1 and 100000
      ),
      constraint apartment_details_net_m2_check check (
        net_m2 is null or net_m2 between 1 and 100000
      ),
      constraint apartment_details_building_age_check check (
        building_age is null or building_age between 0 and 200
      ),
      constraint apartment_details_floor_check check (
        floor is null or floor between -10 and 200
      ),
      constraint apartment_details_total_floors_check check (
        total_floors is null or total_floors between 1 and 200
      ),
      constraint apartment_details_heating_check check (
        heating in (
          'none', 'stove', 'central', 'combi', 'underfloor',
          'air_conditioning', 'heat_pump', 'solar', 'fireplace'
        )
      ),
      constraint apartment_details_bathroom_count_check check (
        bathroom_count between 0 and 20
      ),
      constraint apartment_details_kitchen_check check (
        kitchen in ('open', 'closed')
      ),
      constraint apartment_details_parking_check check (
        parking in ('none', 'open', 'closed', 'both')
      ),
      constraint apartment_details_occupancy_check check (
        occupancy in ('empty', 'tenant', 'owner')
      ),
      constraint apartment_details_deed_status_check check (
        deed_status in (
          'condominium', 'easement', 'shared', 'detached', 'land',
          'cooperative', 'usufruct', 'foreign', 'unregistered'
        )
      ),
      constraint apartment_details_deposit_amount_check check (
        deposit_amount is null or deposit_amount > 0
      )
    );

    create index apartment_details_transaction_gross_idx
      on apartment_details (transaction_type, gross_m2);

    alter table verification_checks
      drop constraint verification_checks_type_check;

    alter table verification_checks
      add constraint verification_checks_type_check check (
        type in ('vehicle_authority', 'property_authority')
      );
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    delete from verification_checks
    where type = 'property_authority';

    alter table verification_checks
      drop constraint verification_checks_type_check;

    alter table verification_checks
      add constraint verification_checks_type_check check (
        type in ('vehicle_authority')
      );

    delete from listings
    where listing_type_id in (
      select id from listing_types
      where code in ('apartment_sale', 'apartment_rent')
    );

    drop table if exists apartment_details;

    delete from listing_types
    where code in ('apartment_sale', 'apartment_rent');
  `.execute(db)
}
