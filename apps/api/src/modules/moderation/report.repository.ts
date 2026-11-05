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
  listingTypeCode: string
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
    reporterIpHash: string | null
    reason: string
    note: string | null
  }): Promise<{ id: string; status: string; createdAt: Date }> {
    return await this.db
      .insertInto('reports')
      .values({
        listing_id: input.listingId,
        reporter_user_id: input.reporterUserId,
        reporter_ip_hash: input.reporterIpHash,
        reason: input.reason,
        note: input.note,
      })
      .returning(['id', 'status', 'created_at as createdAt'])
      .executeTakeFirstOrThrow()
  }

  async findOpenReportForActor(input: {
    listingId: string
    reporterUserId: string | null
    reporterIpHash: string | null
  }): Promise<{ id: string } | null> {
    let query = this.db
      .selectFrom('reports')
      .select('id')
      .where('listing_id', '=', input.listingId)
      .where('status', 'in', ['open', 'reviewing'])

    if (input.reporterUserId) {
      query = query.where('reporter_user_id', '=', input.reporterUserId)
    } else if (input.reporterIpHash) {
      query = query.where('reporter_ip_hash', '=', input.reporterIpHash)
    } else {
      return null
    }

    return await query.executeTakeFirst() ?? null
  }

  async countRecentReportsForActor(input: {
    reporterUserId: string | null
    reporterIpHash: string | null
    since: Date
  }): Promise<number> {
    let query = this.db
      .selectFrom('reports')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('created_at', '>=', input.since)

    if (input.reporterUserId) {
      query = query.where('reporter_user_id', '=', input.reporterUserId)
    } else if (input.reporterIpHash) {
      query = query.where('reporter_ip_hash', '=', input.reporterIpHash)
    } else {
      return 0
    }

    const row = await query.executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async listReports(status?: string): Promise<ModerationReportRow[]> {
    let query = this.db
      .selectFrom('reports')
      .innerJoin('listings', 'listings.id', 'reports.listing_id')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
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

    if (status) {
      query = query.where('reports.status', '=', status)
    }

    return await query
      .orderBy('reports.created_at', 'desc')
      .limit(100)
      .execute()
  }

  async getOpenReportSlaSummary(input: {
    overdueBefore: Date
    dueSoonBefore: Date
  }): Promise<{
    openCount: number
    overdueCount: number
    dueSoonCount: number
    oldestOpenCreatedAt: Date | null
  }> {
    const result = await sql<{
      open_count: string
      overdue_count: string
      due_soon_count: string
      oldest_open_created_at: Date | null
    }>`
      select
        count(*)::text as open_count,
        count(*) filter (where created_at <= ${input.overdueBefore})::text as overdue_count,
        count(*) filter (
          where created_at > ${input.overdueBefore}
            and created_at <= ${input.dueSoonBefore}
        )::text as due_soon_count,
        min(created_at) as oldest_open_created_at
      from reports
      where status in ('open', 'reviewing')
    `.execute(this.db)

    const row = result.rows[0]
    return {
      openCount: Number(row?.open_count ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
      dueSoonCount: Number(row?.due_soon_count ?? 0),
      oldestOpenCreatedAt: row?.oldest_open_created_at ?? null,
    }
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
