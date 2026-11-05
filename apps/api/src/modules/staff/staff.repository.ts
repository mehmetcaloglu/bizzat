import { sql, type Kysely } from 'kysely'
import type { Database } from '../../db/client.js'

export interface StaffUserRow {
  id: string
  name: string
  email: string
  role: string
  accountStatus: string
  suspendedUntil: Date | null
  warningCount: string
  listingCount: string
  createdAt: Date
}

export interface EnforcementRow {
  id: string
  action: string
  reason: string
  listingId: string | null
  listingTitle: string | null
  endsAt: Date | null
  createdAt: Date
  actorName: string | null
}

export interface StaffListingRow {
  id: string
  title: string | null
  listingTypeCode: string
  status: string
  priceAmount: string | null
  currency: string | null
  createdAt: Date
}

export interface StaffListingTargetRow {
  id: string
  ownerUserId: string
  status: string
  title: string | null
}

export class StaffRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async searchUsers(query?: string): Promise<StaffUserRow[]> {
    const search = query?.trim() ?? ''
    const result = search
      ? await sql<StaffUserRow>`
          select
            u.id,
            u.name,
            u.email,
            coalesce(p.role, 'user') as "role",
            coalesce(p.account_status, 'active') as "accountStatus",
            p.suspended_until as "suspendedUntil",
            (
              select count(*)::text
              from account_enforcements e
              where e.target_user_id = u.id and e.action = 'warning'
            ) as "warningCount",
            (
              select count(*)::text
              from listings l
              where l.owner_user_id = u.id
            ) as "listingCount",
            u."createdAt" as "createdAt"
          from auth."user" u
          left join profiles p on p.user_id = u.id
          where u.name ilike ${`%${search}%`} or u.email ilike ${`%${search}%`}
          order by u."createdAt" desc
          limit 25
        `.execute(this.db)
      : await sql<StaffUserRow>`
          select
            u.id,
            u.name,
            u.email,
            coalesce(p.role, 'user') as "role",
            coalesce(p.account_status, 'active') as "accountStatus",
            p.suspended_until as "suspendedUntil",
            (
              select count(*)::text
              from account_enforcements e
              where e.target_user_id = u.id and e.action = 'warning'
            ) as "warningCount",
            (
              select count(*)::text
              from listings l
              where l.owner_user_id = u.id
            ) as "listingCount",
            u."createdAt" as "createdAt"
          from auth."user" u
          left join profiles p on p.user_id = u.id
          order by u."createdAt" desc
          limit 20
        `.execute(this.db)
    return result.rows
  }

  async findUser(userId: string): Promise<StaffUserRow | null> {
    const result = await sql<StaffUserRow>`
      select
        u.id,
        u.name,
        u.email,
        coalesce(p.role, 'user') as "role",
        coalesce(p.account_status, 'active') as "accountStatus",
        p.suspended_until as "suspendedUntil",
        (
          select count(*)::text
          from account_enforcements e
          where e.target_user_id = u.id and e.action = 'warning'
        ) as "warningCount",
        (
          select count(*)::text
          from listings l
          where l.owner_user_id = u.id
        ) as "listingCount",
        u."createdAt" as "createdAt"
      from auth."user" u
      left join profiles p on p.user_id = u.id
      where u.id = ${userId}::uuid
    `.execute(this.db)
    return result.rows[0] ?? null
  }

  async listEnforcements(targetUserId: string, limit = 50): Promise<EnforcementRow[]> {
    const result = await sql<EnforcementRow>`
      select
        e.id,
        e.action,
        e.reason,
        e.listing_id as "listingId",
        l.title as "listingTitle",
        e.ends_at as "endsAt",
        e.created_at as "createdAt",
        actor.name as "actorName"
      from account_enforcements e
      left join listings l on l.id = e.listing_id
      left join auth."user" actor on actor.id = e.actor_user_id
      where e.target_user_id = ${targetUserId}::uuid
      order by e.created_at desc
      limit ${limit}
    `.execute(this.db)
    return result.rows
  }

  async findEnforcement(enforcementId: string): Promise<EnforcementRow | null> {
    const result = await sql<EnforcementRow>`
      select
        e.id,
        e.action,
        e.reason,
        e.listing_id as "listingId",
        l.title as "listingTitle",
        e.ends_at as "endsAt",
        e.created_at as "createdAt",
        actor.name as "actorName"
      from account_enforcements e
      left join listings l on l.id = e.listing_id
      left join auth."user" actor on actor.id = e.actor_user_id
      where e.id = ${enforcementId}::uuid
    `.execute(this.db)
    return result.rows[0] ?? null
  }

  async listUserListings(userId: string): Promise<StaffListingRow[]> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .select([
        'listings.id as id',
        'listings.title as title',
        'listing_types.code as listingTypeCode',
        'listings.status as status',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'listings.created_at as createdAt',
      ])
      .where('listings.owner_user_id', '=', userId)
      .orderBy('listings.updated_at', 'desc')
      .limit(50)
      .execute()
  }

  async insertEnforcement(input: {
    targetUserId: string
    actorUserId: string
    action: 'warning' | 'suspend' | 'ban' | 'reactivate' | 'listing_takedown'
    reason: string
    listingId?: string | null
    endsAt?: Date | null
  }): Promise<{ id: string }> {
    return await this.db
      .insertInto('account_enforcements')
      .values({
        target_user_id: input.targetUserId,
        actor_user_id: input.actorUserId,
        action: input.action,
        reason: input.reason,
        listing_id: input.listingId ?? null,
        ends_at: input.endsAt ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  }

  async setSuspended(userId: string, until: Date): Promise<void> {
    await this.db
      .updateTable('profiles')
      .set({ account_status: 'suspended', suspended_until: until, updated_at: new Date() })
      .where('user_id', '=', userId)
      .execute()
  }

  async setBanned(userId: string): Promise<void> {
    await this.db
      .updateTable('profiles')
      .set({ account_status: 'banned', suspended_until: null, updated_at: new Date() })
      .where('user_id', '=', userId)
      .execute()
  }

  async setActive(userId: string): Promise<void> {
    await this.db
      .updateTable('profiles')
      .set({ account_status: 'active', suspended_until: null, updated_at: new Date() })
      .where('user_id', '=', userId)
      .execute()
  }

  async closePublishedListings(userId: string): Promise<number> {
    const result = await this.db
      .updateTable('listings')
      .set({ status: 'inactive', updated_at: new Date() })
      .where('owner_user_id', '=', userId)
      .where('status', '=', 'published')
      .executeTakeFirst()
    return Number(result.numUpdatedRows)
  }

  async findListingForStaff(listingId: string): Promise<StaffListingTargetRow | null> {
    return await this.db
      .selectFrom('listings')
      .select([
        'id',
        'owner_user_id as ownerUserId',
        'status',
        'title',
      ])
      .where('id', '=', listingId)
      .executeTakeFirst() ?? null
  }

  async rejectListingForStaff(listingId: string): Promise<void> {
    await this.db
      .updateTable('listings')
      .set({ status: 'rejected', updated_at: new Date() })
      .where('id', '=', listingId)
      .execute()
  }
}
