import { Type } from 'typebox'

export const UserRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('moderator'),
  Type.Literal('admin'),
])

export const AccountStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('suspended'),
  Type.Literal('banned'),
])

export const EnforcementActionSchema = Type.Union([
  Type.Literal('warning'),
  Type.Literal('suspend'),
  Type.Literal('ban'),
  Type.Literal('reactivate'),
  Type.Literal('listing_takedown'),
])

export const AccountEnforcementSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  action: EnforcementActionSchema,
  reason: Type.String({ minLength: 5, maxLength: 1000 }),
  listingId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  listingTitle: Type.Union([Type.String(), Type.Null()]),
  endsAt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  createdAt: Type.String({ minLength: 1 }),
})

export const MeResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String({ format: 'uuid' }),
    name: Type.String(),
    email: Type.String({ format: 'email' }),
  }),
  profile: Type.Object({
    role: UserRoleSchema,
    accountStatus: AccountStatusSchema,
    suspendedUntil: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
  enforcements: Type.Array(AccountEnforcementSchema),
})
