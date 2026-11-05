import { sql, type Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    alter table profiles
      add column account_status text not null default 'active',
      add column suspended_until timestamptz;

    alter table profiles
      add constraint profiles_account_status_check check (
        account_status in ('active', 'suspended', 'banned')
      );

    alter table profiles
      add constraint profiles_suspension_state_check check (
        (account_status = 'suspended' and suspended_until is not null)
        or (account_status <> 'suspended' and suspended_until is null)
      );

    create table account_enforcements (
      id uuid primary key default uuidv7(),
      target_user_id uuid not null references auth."user"(id) on delete cascade,
      actor_user_id uuid references auth."user"(id) on delete set null,
      action text not null,
      reason text not null,
      listing_id uuid references listings(id) on delete set null,
      ends_at timestamptz,
      created_at timestamptz not null default now(),
      constraint account_enforcements_action_check check (
        action in ('warning', 'suspend', 'ban', 'reactivate', 'listing_takedown')
      ),
      constraint account_enforcements_reason_length_check check (
        char_length(reason) between 5 and 1000
      ),
      constraint account_enforcements_suspend_ends_at_check check (
        (action = 'suspend' and ends_at is not null)
        or (action <> 'suspend' and ends_at is null)
      )
    );

    create index account_enforcements_target_created_idx
      on account_enforcements (target_user_id, created_at desc);

    create index account_enforcements_actor_created_idx
      on account_enforcements (actor_user_id, created_at desc)
      where actor_user_id is not null;
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    drop table if exists account_enforcements;

    alter table profiles
      drop constraint if exists profiles_suspension_state_check;

    alter table profiles
      drop constraint if exists profiles_account_status_check;

    alter table profiles
      drop column if exists suspended_until,
      drop column if exists account_status;
  `.execute(db)
}
