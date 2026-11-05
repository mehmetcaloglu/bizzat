import { Type, type Static } from 'typebox'

export const ReportReasonSchema = Type.Union([
  Type.Literal('fraud'),
  Type.Literal('wrong_category'),
  Type.Literal('prohibited'),
  Type.Literal('duplicate'),
  Type.Literal('misleading'),
  Type.Literal('other'),
])

export const CreateListingReportRequestSchema = Type.Object({
  reason: ReportReasonSchema,
  note: Type.Optional(Type.String({ maxLength: 1000 })),
}, { additionalProperties: false })

export const CreateListingReportResponseSchema = Type.Object({
  report: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Literal('open'),
    createdAt: Type.String({ minLength: 1 }),
  }),
})

export const ModerationReportStatusSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('reviewing'),
  Type.Literal('resolved'),
  Type.Literal('dismissed'),
])

export const ModerationSlaStateSchema = Type.Union([
  Type.Literal('on_track'),
  Type.Literal('due_soon'),
  Type.Literal('overdue'),
])

export const ModerationListingTypeSchema = Type.Union([
  Type.Literal('car_sale'),
  Type.Literal('apartment_sale'),
  Type.Literal('apartment_rent'),
])

export const ModerationReportSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  listingId: Type.String({ format: 'uuid' }),
  reason: ReportReasonSchema,
  note: Type.Union([Type.String(), Type.Null()]),
  status: ModerationReportStatusSchema,
  reporterType: Type.Union([Type.Literal('guest'), Type.Literal('member')]),
  createdAt: Type.String({ minLength: 1 }),
  slaDueAt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  slaState: Type.Union([ModerationSlaStateSchema, Type.Null()]),
  listing: Type.Object({
    type: ModerationListingTypeSchema,
    title: Type.Union([Type.String(), Type.Null()]),
    status: Type.String({ minLength: 1 }),
    priceAmount: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
    currency: Type.Union([Type.Literal('TRY'), Type.Null()]),
    provinceName: Type.Union([Type.String(), Type.Null()]),
    districtName: Type.Union([Type.String(), Type.Null()]),
    imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
})

export const ModerationReportListResponseSchema = Type.Object({
  items: Type.Array(ModerationReportSchema),
  summary: Type.Object({
    slaHours: Type.Integer({ minimum: 1 }),
    openCount: Type.Integer({ minimum: 0 }),
    overdueCount: Type.Integer({ minimum: 0 }),
    dueSoonCount: Type.Integer({ minimum: 0 }),
    oldestOpenCreatedAt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  }),
})

export const ResolveModerationReportRequestSchema = Type.Object({
  action: Type.Union([Type.Literal('reject'), Type.Literal('dismiss')]),
  note: Type.Optional(Type.String({ maxLength: 2000 })),
}, { additionalProperties: false })

export const ResolveModerationReportResponseSchema = Type.Object({
  report: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Union([Type.Literal('resolved'), Type.Literal('dismissed')]),
    reviewedAt: Type.String({ minLength: 1 }),
  }),
})

export type CreateListingReportRequest = Static<typeof CreateListingReportRequestSchema>
export type CreateListingReportResponse = Static<typeof CreateListingReportResponseSchema>
export type ModerationReportListResponse = Static<typeof ModerationReportListResponseSchema>
export type ResolveModerationReportRequest = Static<typeof ResolveModerationReportRequestSchema>
export type ResolveModerationReportResponse = Static<typeof ResolveModerationReportResponseSchema>
