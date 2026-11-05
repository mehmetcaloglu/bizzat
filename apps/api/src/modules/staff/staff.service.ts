import type {
  AccountEnforcement,
  StaffListingSummary,
  StaffListingTakedownResponse,
  StaffReasonRequest,
  StaffSuspendRequest,
  StaffUserActionResponse,
  StaffUserDetailResponse,
  StaffUserListResponse,
  StaffUserSummary,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { ensureProfile } from '../users/profile.repository.js'
import {
  StaffRepository,
  type EnforcementRow,
  type StaffListingRow,
  type StaffUserRow,
} from './staff.repository.js'

export function staffUserSummary(row: StaffUserRow): StaffUserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as StaffUserSummary['role'],
    accountStatus: row.accountStatus as StaffUserSummary['accountStatus'],
    suspendedUntil: row.suspendedUntil ? row.suspendedUntil.toISOString() : null,
    warningCount: Number(row.warningCount),
    listingCount: Number(row.listingCount),
    createdAt: row.createdAt.toISOString(),
  }
}

export function enforcementSummary(row: EnforcementRow): AccountEnforcement {
  return {
    id: row.id,
    action: row.action as AccountEnforcement['action'],
    reason: row.reason,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function staffListingSummary(row: StaffListingRow): StaffListingSummary {
  return {
    id: row.id,
    title: row.title,
    type: row.listingTypeCode as StaffListingSummary['type'],
    status: row.status,
    priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
    currency: row.currency === 'TRY' ? 'TRY' : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export class StaffService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: StaffRepository,
  ) {}

  async searchUsers(query?: string): Promise<StaffUserListResponse> {
    const rows = await this.repository.searchUsers(query)
    return { items: rows.map(staffUserSummary) }
  }

  async getUserDetail(userId: string): Promise<StaffUserDetailResponse> {
    const user = await this.repository.findUser(userId)
    if (!user) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Kullanıcı bulunamadı.')
    const [enforcements, listings] = await Promise.all([
      this.repository.listEnforcements(userId),
      this.repository.listUserListings(userId),
    ])
    return {
      user: staffUserSummary(user),
      enforcements: enforcements.map(enforcementSummary),
      listings: listings.map(staffListingSummary),
    }
  }

  async warnUser(
    actorUserId: string,
    targetUserId: string,
    input: StaffReasonRequest,
  ): Promise<StaffUserActionResponse> {
    const reason = await this.authorizeTarget(actorUserId, targetUserId, input.reason)
    const enforcement = await this.repository.insertEnforcement({
      targetUserId,
      actorUserId,
      action: 'warning',
      reason,
    })
    return await this.actionResponse(targetUserId, enforcement.id)
  }

  async suspendUser(
    actorUserId: string,
    targetUserId: string,
    input: StaffSuspendRequest,
  ): Promise<StaffUserActionResponse> {
    const reason = await this.authorizeTarget(actorUserId, targetUserId, input.reason)
    const endsAt = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000)
    const enforcementId = await this.db.transaction().execute(async (transaction) => {
      const repository = new StaffRepository(transaction)
      await repository.setSuspended(targetUserId, endsAt)
      await repository.closePublishedListings(targetUserId)
      const inserted = await repository.insertEnforcement({
        targetUserId,
        actorUserId,
        action: 'suspend',
        reason,
        endsAt,
      })
      return inserted.id
    })
    return await this.actionResponse(targetUserId, enforcementId)
  }

  async banUser(
    actorUserId: string,
    targetUserId: string,
    input: StaffReasonRequest,
  ): Promise<StaffUserActionResponse> {
    const reason = await this.authorizeTarget(actorUserId, targetUserId, input.reason)
    const enforcementId = await this.db.transaction().execute(async (transaction) => {
      const repository = new StaffRepository(transaction)
      await repository.setBanned(targetUserId)
      await repository.closePublishedListings(targetUserId)
      const inserted = await repository.insertEnforcement({
        targetUserId,
        actorUserId,
        action: 'ban',
        reason,
      })
      return inserted.id
    })
    return await this.actionResponse(targetUserId, enforcementId)
  }

  async reactivateUser(
    actorUserId: string,
    targetUserId: string,
    input: StaffReasonRequest,
  ): Promise<StaffUserActionResponse> {
    const reason = await this.authorizeTarget(actorUserId, targetUserId, input.reason)
    const enforcementId = await this.db.transaction().execute(async (transaction) => {
      const repository = new StaffRepository(transaction)
      await repository.setActive(targetUserId)
      const inserted = await repository.insertEnforcement({
        targetUserId,
        actorUserId,
        action: 'reactivate',
        reason,
      })
      return inserted.id
    })
    return await this.actionResponse(targetUserId, enforcementId)
  }

  async takedownListing(
    actorUserId: string,
    listingId: string,
    input: StaffReasonRequest,
  ): Promise<StaffListingTakedownResponse> {
    const listing = await this.repository.findListingForStaff(listingId)
    if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (listing.status === 'rejected') {
      throw new AppError(409, 'VALIDATION_ERROR', 'İlan zaten kapatılmış.')
    }
    const reason = await this.authorizeTarget(actorUserId, listing.ownerUserId, input.reason)
    const enforcementId = await this.db.transaction().execute(async (transaction) => {
      const repository = new StaffRepository(transaction)
      await repository.rejectListingForStaff(listingId)
      const inserted = await repository.insertEnforcement({
        targetUserId: listing.ownerUserId,
        actorUserId,
        action: 'listing_takedown',
        reason,
        listingId,
      })
      return inserted.id
    })
    const enforcement = await this.repository.findEnforcement(enforcementId)
    if (!enforcement) throw new AppError(500, 'INTERNAL_ERROR', 'Yaptırım kaydı oluşturulamadı.')
    return {
      listing: { id: listingId, status: 'rejected' },
      enforcement: enforcementSummary(enforcement),
    }
  }

  private async authorizeTarget(
    actorUserId: string,
    targetUserId: string,
    reasonInput: string,
  ): Promise<string> {
    const reason = reasonInput.trim()
    if (reason.length < 5) {
      throw new AppError(400, 'VALIDATION_ERROR', 'İşlem nedeni en az 5 karakter olmalı.')
    }
    if (actorUserId === targetUserId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Kendi hesabına yaptırım uygulayamazsın.')
    }

    const targetRow = await this.repository.findUser(targetUserId)
    if (!targetRow) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Kullanıcı bulunamadı.')
    const [actor, target] = await Promise.all([
      ensureProfile(this.db, actorUserId),
      ensureProfile(this.db, targetUserId),
    ])
    if (target.role === 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Admin hesaplarına yaptırım uygulanamaz.')
    }
    if (actor.role !== 'admin' && target.role === 'moderator') {
      throw new AppError(403, 'FORBIDDEN', 'Moderatörler birbirine yaptırım uygulayamaz.')
    }
    return reason
  }

  private async actionResponse(
    targetUserId: string,
    enforcementId: string,
  ): Promise<StaffUserActionResponse> {
    const [user, enforcement] = await Promise.all([
      this.repository.findUser(targetUserId),
      this.repository.findEnforcement(enforcementId),
    ])
    if (!user || !enforcement) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Yaptırım kaydı oluşturulamadı.')
    }
    return {
      user: staffUserSummary(user),
      enforcement: enforcementSummary(enforcement),
    }
  }
}
