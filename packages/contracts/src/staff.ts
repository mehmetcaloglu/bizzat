import { Type, type Static } from 'typebox'
import {
  AccountEnforcementSchema,
  AccountStatusSchema,
  EnforcementActionSchema,
  UserRoleSchema,
} from './me.js'

export const StaffUserSummarySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  role: UserRoleSchema,
  accountStatus: AccountStatusSchema,
  suspendedUntil: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  warningCount: Type.Integer({ minimum: 0 }),
  listingCount: Type.Integer({ minimum: 0 }),
  createdAt: Type.String({ minLength: 1 }),
})

export const StaffUserListResponseSchema = Type.Object({
  items: Type.Array(StaffUserSummarySchema),
})

export const StaffListingSummarySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.Union([Type.String(), Type.Null()]),
  type: Type.Union([
    Type.Literal('car_sale'),
    Type.Literal('apartment_sale'),
    Type.Literal('apartment_rent'),
  ]),
  status: Type.String({ minLength: 1 }),
  priceAmount: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
  currency: Type.Union([Type.Literal('TRY'), Type.Null()]),
  createdAt: Type.String({ minLength: 1 }),
})

export const StaffUserDetailResponseSchema = Type.Object({
  user: StaffUserSummarySchema,
  enforcements: Type.Array(AccountEnforcementSchema),
  listings: Type.Array(StaffListingSummarySchema),
})

export const StaffReasonRequestSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 1000 }),
}, { additionalProperties: false })

export const StaffSuspendRequestSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 1000 }),
  days: Type.Integer({ minimum: 1, maximum: 365 }),
}, { additionalProperties: false })

export const StaffUserActionResponseSchema = Type.Object({
  user: StaffUserSummarySchema,
  enforcement: AccountEnforcementSchema,
})

export const StaffListingTakedownResponseSchema = Type.Object({
  listing: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Literal('rejected'),
  }),
  enforcement: AccountEnforcementSchema,
})

export const StaffUserQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
}, { additionalProperties: false })

export type StaffUserSummary = Static<typeof StaffUserSummarySchema>
export type StaffListingSummary = Static<typeof StaffListingSummarySchema>
export type StaffUserListResponse = Static<typeof StaffUserListResponseSchema>
export type StaffUserDetailResponse = Static<typeof StaffUserDetailResponseSchema>
export type StaffUserActionResponse = Static<typeof StaffUserActionResponseSchema>
export type StaffListingTakedownResponse = Static<typeof StaffListingTakedownResponseSchema>
export type StaffReasonRequest = Static<typeof StaffReasonRequestSchema>
export type StaffSuspendRequest = Static<typeof StaffSuspendRequestSchema>
export type AccountEnforcement = Static<typeof AccountEnforcementSchema>
export type EnforcementAction = Static<typeof EnforcementActionSchema>
