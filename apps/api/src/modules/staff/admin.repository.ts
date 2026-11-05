import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database, UserRole } from '../../db/client.js'

export interface AdminSummaryCounts {
  totalUsers: string
  activeUsers: string
  suspendedUsers: string
  bannedUsers: string
  moderators: string
  admins: string
  totalListings: string
  publishedListings: string
  rejectedListings: string
  inactiveListings: string
  openReports: string
  overdueReports: string
  pendingAppeals: string
  enforcementsLast30Days: string
}

export interface AdminEnforcementRow {
  id: string
  action: string
  reason: string
  targetUserId: string
  targetName: string
  targetEmail: string
  actorName: string | null
  listingTitle: string | null
  createdAt: Date
}

type AdminDatabase = Kysely<Database> | Transaction<Database>

export class AdminRepository {
  constructor(private readonly db: AdminDatabase) {}

  async counts(overdueBefore: Date): Promise<AdminSummaryCounts> {
    const result = await sql<AdminSummaryCounts>`
      select
        (select count(*)::text from auth."user") as "totalUsers",
        (select count(*)::text from profiles where account_status = 'active') as "activeUsers",
        (select count(*)::text from profiles where account_status = 'suspended') as "suspendedUsers",
        (select count(*)::text from profiles where account_status = 'banned') as "bannedUsers",
        (select count(*)::text from profiles where role = 'moderator') as "moderators",
        (select count(*)::text from profiles where role = 'admin') as "admins",
        (select count(*)::text from listings) as "totalListings",
        (select count(*)::text from listings where status = 'published') as "publishedListings",
        (select count(*)::text from listings where status = 'rejected') as "rejectedListings",
        (select count(*)::text from listings where status = 'inactive') as "inactiveListings",
        (
          select count(*)::text from reports
          where status in ('open', 'reviewing')
        ) as "openReports",
        (
          select count(*)::text from reports
          where status in ('open', 'reviewing') and created_at <= ${overdueBefore}
        ) as "overdueReports",
        (
          select count(*)::text from listing_appeals
          where status = 'pending'
        ) as "pendingAppeals",
        (
          select count(*)::text from account_enforcements
          where created_at >= now() - interval '30 days'
        ) as "enforcementsLast30Days"
    `.execute(this.db)
    return result.rows[0] ?? {
      totalUsers: '0', activeUsers: '0', suspendedUsers: '0', bannedUsers: '0',
      moderators: '0', admins: '0', totalListings: '0', publishedListings: '0',
      rejectedListings: '0', inactiveListings: '0', openReports: '0',
      overdueReports: '0', pendingAppeals: '0', enforcementsLast30Days: '0',
    }
  }

  async listRecentEnforcements(limit = 30): Promise<AdminEnforcementRow[]> {
    const result = await sql<AdminEnforcementRow>`
      select
        e.id,
        e.action,
        e.reason,
        e.target_user_id as "targetUserId",
        target.name as "targetName",
        target.email as "targetEmail",
        actor.name as "actorName",
        l.title as "listingTitle",
        e.created_at as "createdAt"
      from account_enforcements e
      inner join auth."user" target on target.id = e.target_user_id
      left join auth."user" actor on actor.id = e.actor_user_id
      left join listings l on l.id = e.listing_id
      order by e.created_at desc
      limit ${limit}
    `.execute(this.db)
    return result.rows
  }

  async countAdmins(): Promise<number> {
    const row = await this.db
      .selectFrom('profiles')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('role', '=', 'admin')
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async updateRole(userId: string, role: UserRole): Promise<void> {
    await this.db
      .updateTable('profiles')
      .set({ role, updated_at: new Date() })
      .where('user_id', '=', userId)
      .execute()
  }
}
