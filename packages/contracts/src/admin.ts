import { Type, type Static } from 'typebox'
import { AccountEnforcementSchema, EnforcementActionSchema, UserRoleSchema } from './me.js'
import { StaffUserSummarySchema } from './staff.js'

export const AdminSummarySchema = Type.Object({
  users: Type.Object({
    total: Type.Integer({ minimum: 0 }),
    active: Type.Integer({ minimum: 0 }),
    suspended: Type.Integer({ minimum: 0 }),
    banned: Type.Integer({ minimum: 0 }),
    moderators: Type.Integer({ minimum: 0 }),
    admins: Type.Integer({ minimum: 0 }),
  }),
  listings: Type.Object({
    total: Type.Integer({ minimum: 0 }),
    published: Type.Integer({ minimum: 0 }),
    rejected: Type.Integer({ minimum: 0 }),
    inactive: Type.Integer({ minimum: 0 }),
  }),
  moderation: Type.Object({
    openReports: Type.Integer({ minimum: 0 }),
    overdueReports: Type.Integer({ minimum: 0 }),
    pendingAppeals: Type.Integer({ minimum: 0 }),
  }),
  enforcementsLast30Days: Type.Integer({ minimum: 0 }),
})

export const AdminEnforcementItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  action: EnforcementActionSchema,
  reason: Type.String({ minLength: 5, maxLength: 1000 }),
  targetUserId: Type.String({ format: 'uuid' }),
  targetName: Type.String(),
  targetEmail: Type.String({ format: 'email' }),
  actorName: Type.Union([Type.String(), Type.Null()]),
  listingTitle: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ minLength: 1 }),
})

export const AdminEnforcementListResponseSchema = Type.Object({
  items: Type.Array(AdminEnforcementItemSchema),
})

export const AdminRoleRequestSchema = Type.Object({
  role: UserRoleSchema,
}, { additionalProperties: false })

export const AdminRoleResponseSchema = Type.Object({
  user: StaffUserSummarySchema,
  enforcement: AccountEnforcementSchema,
})

export type AdminSummary = Static<typeof AdminSummarySchema>
export type AdminEnforcementItem = Static<typeof AdminEnforcementItemSchema>
export type AdminEnforcementListResponse = Static<typeof AdminEnforcementListResponseSchema>
export type AdminRoleRequest = Static<typeof AdminRoleRequestSchema>
export type AdminRoleResponse = Static<typeof AdminRoleResponseSchema>
