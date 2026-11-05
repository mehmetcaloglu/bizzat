import type {
  CreateListingReportRequest,
  CreateListingReportResponse,
  ModerationReportListResponse,
  ResolveModerationReportRequest,
  ResolveModerationReportResponse,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import {
  GUEST_REPORT_HOURLY_LIMIT,
  MEMBER_REPORT_HOURLY_LIMIT,
  REPORT_RATE_LIMIT_WINDOW_MS,
} from './report-abuse.js'
import {
  ReportRepository,
  type ModerationReportRow,
} from './report.repository.js'

function optionalNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function reportSummary(row: ModerationReportRow): ModerationReportListResponse['items'][number] {
  return {
    id: row.id,
    listingId: row.listingId,
    reason: row.reason as ModerationReportListResponse['items'][number]['reason'],
    note: row.note,
    status: row.status as ModerationReportListResponse['items'][number]['status'],
    reporterType: row.reporterUserId ? 'member' : 'guest',
    createdAt: row.createdAt.toISOString(),
    listing: {
      title: row.listingTitle,
      status: row.listingStatus,
      priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
      currency: row.currency === 'TRY' ? 'TRY' : null,
      provinceName: row.provinceName,
      districtName: row.districtName,
      imageUrl: row.imageId && row.listingStatus === 'published'
        ? `/api/v1/listings/public/images/${row.imageId}`
        : null,
    },
  }
}

export class ReportService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: ReportRepository,
  ) {}

  async reportListing(
    listingId: string,
    input: CreateListingReportRequest,
    reporterUserId: string | null,
    reporterIpHash: string | null,
  ): Promise<CreateListingReportResponse> {
    const listing = await this.repository.findReportableListing(listingId)
    if (!listing || listing.status !== 'published') {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    if (reporterUserId && listing.ownerUserId === reporterUserId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Kendi ilanını raporlayamazsın.')
    }
    if (!reporterUserId && !reporterIpHash) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Rapor gönderimi doğrulanamadı.')
    }

    const duplicate = await this.repository.findOpenReportForActor({
      listingId,
      reporterUserId,
      reporterIpHash,
    })
    if (duplicate) {
      throw new AppError(
        409,
        'REPORT_ALREADY_OPEN',
        'Bu ilan için zaten açık bir raporun var.',
      )
    }

    const recentReports = await this.repository.countRecentReportsForActor({
      reporterUserId,
      reporterIpHash,
      since: new Date(Date.now() - REPORT_RATE_LIMIT_WINDOW_MS),
    })
    const limit = reporterUserId ? MEMBER_REPORT_HOURLY_LIMIT : GUEST_REPORT_HOURLY_LIMIT
    if (recentReports >= limit) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Çok fazla rapor gönderdin. Lütfen daha sonra tekrar dene.',
      )
    }

    const report = await this.repository.insertReport({
      listingId,
      reporterUserId,
      reporterIpHash,
      reason: input.reason,
      note: optionalNote(input.note),
    })

    return {
      report: {
        id: report.id,
        status: 'open',
        createdAt: report.createdAt.toISOString(),
      },
    }
  }

  async listReports(status?: string): Promise<ModerationReportListResponse> {
    const rows = await this.repository.listReports(status === 'all' ? undefined : status)
    return {
      items: rows.map((row) => reportSummary(row)),
    }
  }

  async resolveReport(
    reportId: string,
    moderatorUserId: string,
    input: ResolveModerationReportRequest,
  ): Promise<ResolveModerationReportResponse> {
    const note = optionalNote(input.note)
    const reviewedAt = new Date()

    const status = await this.db.transaction().execute(async (transaction) => {
      const repository = new ReportRepository(transaction)
      const report = await repository.findReportForUpdate(reportId)
      if (!report) {
        throw new AppError(404, 'REPORT_NOT_FOUND', 'Rapor bulunamadı.')
      }
      if (report.status !== 'open' && report.status !== 'reviewing') {
        throw new AppError(409, 'REPORT_ALREADY_REVIEWED', 'Bu rapor daha önce incelenmiş.')
      }

      if (input.action === 'reject') {
        await repository.rejectListingByModeration(report.listingId)
        await repository.resolveOpenReportsForListing({
          listingId: report.listingId,
          moderatorUserId,
          note,
          reviewedAt,
        })
        return 'resolved' as const
      }

      const resolved = await repository.resolveReport({
        reportId,
        status: 'dismissed',
        moderatorUserId,
        note,
        reviewedAt,
      })
      if (!resolved) {
        throw new AppError(409, 'REPORT_ALREADY_REVIEWED', 'Bu rapor daha önce incelenmiş.')
      }
      return 'dismissed' as const
    })

    return {
      report: {
        id: reportId,
        status,
        reviewedAt: reviewedAt.toISOString(),
      },
    }
  }
}
