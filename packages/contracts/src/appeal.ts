import { Type, type Static } from 'typebox'

export const AppealStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('approved'),
  Type.Literal('rejected'),
])

export const AppealListingTypeSchema = Type.Union([
  Type.Literal('car_sale'),
  Type.Literal('apartment_sale'),
  Type.Literal('apartment_rent'),
])

export const CreateListingAppealRequestSchema = Type.Object({
  note: Type.String({ minLength: 10, maxLength: 1000 }),
}, { additionalProperties: false })

export const CreateListingAppealResponseSchema = Type.Object({
  appeal: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Literal('pending'),
    createdAt: Type.String({ minLength: 1 }),
  }),
})

export const ModerationAppealSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  listingId: Type.String({ format: 'uuid' }),
  status: AppealStatusSchema,
  note: Type.String({ minLength: 10, maxLength: 1000 }),
  createdAt: Type.String({ minLength: 1 }),
  listing: Type.Object({
    type: AppealListingTypeSchema,
    title: Type.Union([Type.String(), Type.Null()]),
    status: Type.String({ minLength: 1 }),
    priceAmount: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
    currency: Type.Union([Type.Literal('TRY'), Type.Null()]),
    provinceName: Type.Union([Type.String(), Type.Null()]),
    districtName: Type.Union([Type.String(), Type.Null()]),
    imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
})

export const ModerationAppealListResponseSchema = Type.Object({
  items: Type.Array(ModerationAppealSchema),
})

export const ResolveModerationAppealRequestSchema = Type.Object({
  action: Type.Union([Type.Literal('approve'), Type.Literal('reject')]),
  note: Type.Optional(Type.String({ maxLength: 2000 })),
}, { additionalProperties: false })

export const ResolveModerationAppealResponseSchema = Type.Object({
  appeal: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]),
    reviewedAt: Type.String({ minLength: 1 }),
  }),
})

export type AppealStatus = Static<typeof AppealStatusSchema>
export type CreateListingAppealRequest = Static<typeof CreateListingAppealRequestSchema>
export type CreateListingAppealResponse = Static<typeof CreateListingAppealResponseSchema>
export type ModerationAppeal = Static<typeof ModerationAppealSchema>
export type ModerationAppealListResponse = Static<typeof ModerationAppealListResponseSchema>
export type ResolveModerationAppealRequest = Static<typeof ResolveModerationAppealRequestSchema>
export type ResolveModerationAppealResponse = Static<typeof ResolveModerationAppealResponseSchema>
