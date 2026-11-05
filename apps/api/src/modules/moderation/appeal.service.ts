import type {
  CreateListingAppealRequest,
  CreateListingAppealResponse,
  ModerationAppealListResponse,
  ResolveModerationAppealRequest,
  ResolveModerationAppealResponse,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { AppealRepository, type ModerationAppealRow } from './appeal.repository.js'

function appealSummary(
  row: ModerationAppealRow,
): ModerationAppealListResponse['items'][number] {
  return {
    id: row.id,
    listingId: row.listingId,
    status: row.status as ModerationAppealListResponse['items'][number]['status'],
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    listing: {
      type: row.listingTypeCode as ModerationAppealListResponse['items'][number]['listing']['type'],
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

export class AppealService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: AppealRepository,
  ) {}

  async createAppeal(
    listingId: string,
    ownerUserId: string,
    input: CreateListingAppealRequest,
  ): Promise<CreateListingAppealResponse> {
    const note = input.note.trim()
    if (note.length < 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'İtiraz notu en az 10 karakter olmalı.')
    }

    const listing = await this.repository.findOwnedListingStatus(ownerUserId, listingId)
    if (!listing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    if (listing.status !== 'rejected') {
      throw new AppError(
        409,
        'APPEAL_NOT_ALLOWED',
        'Yalnız reddedilen ilanlar için itiraz gönderebilirsin.',
      )
    }

    const appeal = await this.repository.insertAppeal({
      listingId,
      appellantUserId: ownerUserId,
      note,
    })
    if (!appeal) {
      throw new AppError(409, 'APPEAL_ALREADY_EXISTS', 'Bu ilan için zaten bir itirazın var.')
    }

    return {
      appeal: {
        id: appeal.id,
        status: 'pending',
        createdAt: appeal.createdAt.toISOString(),
      },
    }
  }

  async listAppeals(status?: string): Promise<ModerationAppealListResponse> {
    const rows = await this.repository.listAppeals(status === 'all' ? undefined : status)
    return { items: rows.map(appealSummary) }
  }

  async resolveAppeal(
    appealId: string,
    moderatorUserId: string,
    input: ResolveModerationAppealRequest,
  ): Promise<ResolveModerationAppealResponse> {
    const reviewedAt = new Date()
    const note = input.note?.trim() || null

    await this.db.transaction().execute(async (transaction) => {
      const repository = new AppealRepository(transaction)
      const appeal = await repository.findAppealForUpdate(appealId)
      if (!appeal) {
        throw new AppError(404, 'APPEAL_NOT_FOUND', 'İtiraz bulunamadı.')
      }
      if (appeal.status !== 'pending') {
        throw new AppError(409, 'APPEAL_ALREADY_REVIEWED', 'Bu itiraz daha önce incelenmiş.')
      }

      if (input.action === 'approve') {
        const listing = await repository.findListingStatusForUpdate(appeal.listingId)
        if (!listing || listing.status !== 'rejected') {
          throw new AppError(
            409,
            'APPEAL_NOT_ALLOWED',
            'İlan itirazı kabul etmek için uygun durumda değil.',
          )
        }
        await repository.approveListingFromAppeal(listing.id, reviewedAt)
      }

      await repository.reviewAppeal({
        appealId,
        status: input.action === 'approve' ? 'approved' : 'rejected',
        moderatorUserId,
        note,
        reviewedAt,
      })
    })

    return {
      appeal: {
        id: appealId,
        status: input.action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: reviewedAt.toISOString(),
      },
    }
  }
}
