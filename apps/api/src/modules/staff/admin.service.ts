import type {
  AdminEnforcementListResponse,
  AdminRoleRequest,
  AdminRoleResponse,
  AdminSummary,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { moderationSlaCutoffs } from '../moderation/moderation-sla.js'
import { AdminRepository } from './admin.repository.js'
import { StaffRepository } from './staff.repository.js'
import { enforcementSummary, staffUserSummary } from './staff.service.js'

export class AdminService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly adminRepository: AdminRepository,
    private readonly staffRepository: StaffRepository,
  ) {}

  async summary(): Promise<AdminSummary> {
    const cutoffs = moderationSlaCutoffs()
    const counts = await this.adminRepository.counts(cutoffs.overdueBefore)
    return {
      users: {
        total: Number(counts.totalUsers),
        active: Number(counts.activeUsers),
        suspended: Number(counts.suspendedUsers),
        banned: Number(counts.bannedUsers),
        moderators: Number(counts.moderators),
        admins: Number(counts.admins),
      },
      listings: {
        total: Number(counts.totalListings),
        published: Number(counts.publishedListings),
        rejected: Number(counts.rejectedListings),
        inactive: Number(counts.inactiveListings),
      },
      moderation: {
        openReports: Number(counts.openReports),
        overdueReports: Number(counts.overdueReports),
        pendingAppeals: Number(counts.pendingAppeals),
      },
      enforcementsLast30Days: Number(counts.enforcementsLast30Days),
    }
  }

  async listEnforcements(): Promise<AdminEnforcementListResponse> {
    const rows = await this.adminRepository.listRecentEnforcements()
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action as AdminEnforcementListResponse['items'][number]['action'],
        reason: row.reason,
        targetUserId: row.targetUserId,
        targetName: row.targetName,
        targetEmail: row.targetEmail,
        actorName: row.actorName,
        listingTitle: row.listingTitle,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  }

  async changeRole(
    actorUserId: string,
    targetUserId: string,
    input: AdminRoleRequest,
  ): Promise<AdminRoleResponse> {
    if (actorUserId === targetUserId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Kendi rolünü değiştiremezsin.')
    }

    const target = await this.staffRepository.findUser(targetUserId)
    if (!target) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Kullanıcı bulunamadı.')
    if (target.role === input.role) {
      throw new AppError(409, 'VALIDATION_ERROR', 'Kullanıcı zaten bu rolde.')
    }
    if (target.role === 'admin' && input.role !== 'admin') {
      const adminCount = await this.adminRepository.countAdmins()
      if (adminCount <= 1) {
        throw new AppError(409, 'VALIDATION_ERROR', 'Son admin hesabı düşürülemez.')
      }
    }

    const previousRole = target.role
    await this.db.transaction().execute(async (transaction) => {
      const adminRepository = new AdminRepository(transaction)
      const staffRepository = new StaffRepository(transaction)
      await adminRepository.updateRole(targetUserId, input.role)
      await staffRepository.insertEnforcement({
        targetUserId,
        actorUserId,
        action: 'role_change',
        reason: `Rol değişikliği: ${previousRole} → ${input.role}`,
      })
    })

    const updated = await this.staffRepository.findUser(targetUserId)
    const enforcements = await this.staffRepository.listEnforcements(targetUserId, 1)
    if (!updated || !enforcements[0]) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Rol değişikliği kaydedilemedi.')
    }
    return {
      user: staffUserSummary(updated),
      enforcement: enforcementSummary(enforcements[0]),
    }
  }
}
