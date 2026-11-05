import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database } from '../../db/client.js'

type AppealDatabase = Kysely<Database> | Transaction<Database>

export interface ModerationAppealRow {
  id: string
  listingId: string
  status: string
  note: string
  createdAt: Date
  listingTypeCode: string
  listingTitle: string | null
  listingStatus: string
  priceAmount: string | null
  currency: string | null
  provinceName: string | null
  districtName: string | null
  imageId: string | null
}

export interface AppealReviewRow {
  id: string
  listingId: string
  status: string
}

export class AppealRepository {
  constructor(private readonly db: AppealDatabase) {}

  async findOwnedListingStatus(
    ownerUserId: string,
    listingId: string,
  ): Promise<{ id: string; status: string } | null> {
    return await this.db
      .selectFrom('listings')
      .select(['id', 'status'])
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .executeTakeFirst() ?? null
  }

  async insertAppeal(input: {
    listingId: string
    appellantUserId: string
    note: string
  }): Promise<{ id: string; status: string; createdAt: Date } | null> {
    return await this.db
      .insertInto('listing_appeals')
      .values({
        listing_id: input.listingId,
        appellant_user_id: input.appellantUserId,
        note: input.note,
      })
      .onConflict((conflict) => conflict.column('listing_id').doNothing())
      .returning(['id', 'status', 'created_at as createdAt'])
      .executeTakeFirst() ?? null
  }

  async listAppeals(status?: string): Promise<ModerationAppealRow[]> {
    let query = this.db
      .selectFrom('listing_appeals')
      .innerJoin('listings', 'listings.id', 'listing_appeals.listing_id')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .select([
        'listing_appeals.id as id',
        'listing_appeals.listing_id as listingId',
        'listing_appeals.status as status',
        'listing_appeals.note as note',
        'listing_appeals.created_at as createdAt',
        'listing_types.code as listingTypeCode',
        'listings.title as listingTitle',
        'listings.status as listingStatus',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'provinces.name as provinceName',
        'districts.name as districtName',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
      ])
      .orderBy('listing_appeals.created_at', 'asc')

    if (status) query = query.where('listing_appeals.status', '=', status)
    return await query.execute()
  }

  async findAppealForUpdate(appealId: string): Promise<AppealReviewRow | null> {
    return await this.db
      .selectFrom('listing_appeals')
      .select(['id', 'listing_id as listingId', 'status'])
      .where('id', '=', appealId)
      .forUpdate()
      .executeTakeFirst() ?? null
  }

  async findListingStatusForUpdate(
    listingId: string,
  ): Promise<{ id: string; status: string } | null> {
    return await this.db
      .selectFrom('listings')
      .select(['id', 'status'])
      .where('id', '=', listingId)
      .forUpdate()
      .executeTakeFirst() ?? null
  }

  async approveListingFromAppeal(listingId: string, reviewedAt: Date): Promise<void> {
    await this.db
      .updateTable('listings')
      .set({
        status: 'published',
        published_at: sql`coalesce(published_at, ${reviewedAt})`,
        updated_at: reviewedAt,
      })
      .where('id', '=', listingId)
      .execute()
  }

  async reviewAppeal(input: {
    appealId: string
    status: 'approved' | 'rejected'
    moderatorUserId: string
    note: string | null
    reviewedAt: Date
  }): Promise<void> {
    await this.db
      .updateTable('listing_appeals')
      .set({
        status: input.status,
        reviewed_by_user_id: input.moderatorUserId,
        reviewed_at: input.reviewedAt,
        resolution_note: input.note,
        updated_at: input.reviewedAt,
      })
      .where('id', '=', input.appealId)
      .where('status', '=', 'pending')
      .execute()
  }
}
