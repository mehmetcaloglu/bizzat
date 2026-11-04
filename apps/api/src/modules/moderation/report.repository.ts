import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database } from '../../db/client.js'

type ReportDatabase = Kysely<Database> | Transaction<Database>

export interface ReportableListingRow {
  id: string
  ownerUserId: string
  status: string
}

export interface ModerationReportRow {
  id: string
  listingId: string
  reason: string
  note: string | null
  status: string
  reporterUserId: string | null
  createdAt: Date
  listingTitle: string | null
  listingStatus: string
  priceAmount: string | null
  currency: string | null
  provinceName: string | null
  districtName: string | null
  imageId: string | null
}

export interface ReportReviewRow {
  id: string
  listingId: string
  status: string
}

export class ReportRepository {
  constructor(private readonly db: ReportDatabase) {}

  async findReportableListing(listingId: string): Promise<ReportableListingRow | null> {
    return await this.db
      .selectFrom('listings')
      .select([
        'listings.id as id',
        'listings.owner_user_id as ownerUserId',
        'listings.status as status',
      ])
      .where('listings.id', '=', listingId)
      .executeTakeFirst() ?? null
  }

  async insertReport(input: {
    listingId: string
    reporterUserId: string | null
    reason: string
    note: string | null
  }): Promise<{ id: string; status: string; createdAt: Date }> {
    return await this.db
      .insertInto('reports')
      .values({
        listing_id: input.listingId,
        reporter_user_id: input.reporterUserId,
        reason: input.reason,
        note: input.note,
      })
      .returning(['id', 'status', 'created_at as createdAt'])
      .executeTakeFirstOrThrow()
  }

  async listReports(status?: string): Promise<ModerationReportRow[]> {
    let query = this.db
      .selectFrom('reports')
      .innerJoin('listings', 'listings.id', 'reports.listing_id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .select([
        'reports.id as id',
        'reports.listing_id as listingId',
        'reports.reason as reason',
        'reports.note as note',
        'reports.status as status',
        'reports.reporter_user_id as reporterUserId',
        'reports.created_at as createdAt',
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

    if (status) {
      query = query.where('reports.status', '=', status)
    }

    return await query
      .orderBy('reports.created_at', 'desc')
      .limit(100)
      .execute()
  }

  async findReportForUpdate(reportId: string): Promise<ReportReviewRow | null> {
    return await this.db
      .selectFrom('reports')
      .select([
        'id',
        'listing_id as listingId',
        'status',
      ])
      .where('id', '=', reportId)
      .forUpdate()
      .executeTakeFirst() ?? null
  }

  async resolveReport(input: {
    reportId: string
    status: 'resolved' | 'dismissed'
    moderatorUserId: string
    note: string | null
    reviewedAt: Date
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('reports')
      .set({
        status: input.status,
        reviewed_by_user_id: input.moderatorUserId,
        reviewed_at: input.reviewedAt,
        resolution_note: input.note,
        updated_at: sql`now()`,
      })
      .where('id', '=', input.reportId)
      .where('status', 'in', ['open', 'reviewing'])
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async resolveOpenReportsForListing(input: {
    listingId: string
    moderatorUserId: string
    note: string | null
    reviewedAt: Date
  }): Promise<number> {
    const result = await this.db
      .updateTable('reports')
      .set({
        status: 'resolved',
        reviewed_by_user_id: input.moderatorUserId,
        reviewed_at: input.reviewedAt,
        resolution_note: input.note,
        updated_at: sql`now()`,
      })
      .where('listing_id', '=', input.listingId)
      .where('status', 'in', ['open', 'reviewing'])
      .executeTakeFirst()
    return Number(result.numUpdatedRows)
  }

  async rejectListingByModeration(listingId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        status: 'rejected',
        updated_at: sql`now()`,
      })
      .where('id', '=', listingId)
      .where('status', '=', 'published')
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }
}
