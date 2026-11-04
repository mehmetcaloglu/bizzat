import { Type, type Static } from 'typebox'
import { ListingContactSchema, ListingImageSchema } from './listing.js'

export const ApartmentTransactionTypeSchema = Type.Union([
  Type.Literal('sale'),
  Type.Literal('rent'),
])

export const ApartmentRoomCountSchema = Type.Union([
  Type.Literal('studio'),
  Type.Literal('1+0'),
  Type.Literal('1+1'),
  Type.Literal('1.5+1'),
  Type.Literal('2+0'),
  Type.Literal('2+1'),
  Type.Literal('2.5+1'),
  Type.Literal('2+2'),
  Type.Literal('3+0'),
  Type.Literal('3+1'),
  Type.Literal('3.5+1'),
  Type.Literal('3+2'),
  Type.Literal('4+0'),
  Type.Literal('4+1'),
  Type.Literal('4.5+1'),
  Type.Literal('4+2'),
  Type.Literal('5+1'),
  Type.Literal('5+2'),
  Type.Literal('6+1'),
  Type.Literal('7+1'),
  Type.Literal('8+1'),
  Type.Literal('9+1'),
  Type.Literal('10+'),
])

export const ApartmentHeatingSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('stove'),
  Type.Literal('central'),
  Type.Literal('combi'),
  Type.Literal('underfloor'),
  Type.Literal('air_conditioning'),
  Type.Literal('heat_pump'),
  Type.Literal('solar'),
  Type.Literal('fireplace'),
])

export const ApartmentKitchenSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('closed'),
])

export const ApartmentParkingSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('open'),
  Type.Literal('closed'),
  Type.Literal('both'),
])

export const ApartmentOccupancySchema = Type.Union([
  Type.Literal('empty'),
  Type.Literal('tenant'),
  Type.Literal('owner'),
])

export const ApartmentDeedStatusSchema = Type.Union([
  Type.Literal('condominium'),
  Type.Literal('easement'),
  Type.Literal('shared'),
  Type.Literal('detached'),
  Type.Literal('land'),
  Type.Literal('cooperative'),
  Type.Literal('usufruct'),
  Type.Literal('foreign'),
  Type.Literal('unregistered'),
])

const ApartmentLocationItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1 }),
})

const NullableInteger = (minimum: number, maximum: number) => Type.Union([
  Type.Integer({ minimum, maximum }),
  Type.Null(),
])

const NullableBoolean = Type.Union([Type.Boolean(), Type.Null()])

const ApartmentAttributeFields = {
  roomCount: ApartmentRoomCountSchema,
  grossM2: Type.Integer({ minimum: 1, maximum: 100000 }),
  netM2: NullableInteger(1, 100000),
  buildingAge: NullableInteger(0, 200),
  floor: NullableInteger(-10, 200),
  totalFloors: NullableInteger(1, 200),
  heating: ApartmentHeatingSchema,
  bathroomCount: Type.Integer({ minimum: 0, maximum: 20 }),
  kitchen: ApartmentKitchenSchema,
  balcony: Type.Boolean(),
  elevator: Type.Boolean(),
  parking: ApartmentParkingSchema,
  furnished: Type.Boolean(),
  occupancy: ApartmentOccupancySchema,
  inSite: Type.Boolean(),
  deedStatus: ApartmentDeedStatusSchema,
  creditEligible: NullableBoolean,
  swapAvailable: NullableBoolean,
  depositAmount: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
} as const

export const ApartmentAttributesSchema = Type.Object(ApartmentAttributeFields)

export const ApartmentDraftDetailsSchema = Type.Object({
  priceAmount: Type.Integer({ minimum: 1, maximum: 9_999_999_999 }),
  currency: Type.Literal('TRY'),
  description: Type.String({ minLength: 20, maxLength: 5000 }),
  location: Type.Object({
    province: ApartmentLocationItemSchema,
    district: ApartmentLocationItemSchema,
    neighborhood: ApartmentLocationItemSchema,
  }),
  ...ApartmentAttributeFields,
})

export const CreateApartmentDraftRequestSchema = Type.Object({
  transactionType: ApartmentTransactionTypeSchema,
}, { additionalProperties: false })

export const UpdateApartmentDraftDetailsRequestSchema = Type.Object({
  priceAmount: Type.Integer({ minimum: 1, maximum: 9_999_999_999 }),
  provinceId: Type.String({ format: 'uuid' }),
  districtId: Type.String({ format: 'uuid' }),
  neighborhoodId: Type.String({ format: 'uuid' }),
  description: Type.String({ minLength: 20, maxLength: 5000 }),
  title: Type.Optional(Type.String({ minLength: 10, maxLength: 120 })),
  contactPhoneE164: Type.Optional(Type.String({ pattern: '^\\+90[0-9]{10}$' })),
  showPhone: Type.Optional(Type.Boolean()),
  ...ApartmentAttributeFields,
}, { additionalProperties: false })

export const ApartmentDraftSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: Type.Literal('draft'),
  type: Type.Union([Type.Literal('apartment_sale'), Type.Literal('apartment_rent')]),
  transactionType: ApartmentTransactionTypeSchema,
  title: Type.Union([Type.String({ minLength: 10, maxLength: 120 }), Type.Null()]),
  details: Type.Union([ApartmentDraftDetailsSchema, Type.Null()]),
  contact: Type.Union([ListingContactSchema, Type.Null()]),
  images: Type.Array(ListingImageSchema),
})

export const ApartmentDraftResponseSchema = Type.Object({
  listing: ApartmentDraftSchema,
})

export const PublicApartmentAttributesSchema = Type.Object(ApartmentAttributeFields)

export const PublicApartmentListingItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  type: Type.Union([Type.Literal('apartment_sale'), Type.Literal('apartment_rent')]),
  title: Type.String({ minLength: 1 }),
  priceAmount: Type.Number({ minimum: 1 }),
  currency: Type.Literal('TRY'),
  roomCount: ApartmentRoomCountSchema,
  grossM2: Type.Integer({ minimum: 1 }),
  netM2: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  buildingAge: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  floor: Type.Union([Type.Integer(), Type.Null()]),
  location: Type.Object({
    provinceName: Type.String({ minLength: 1 }),
    districtName: Type.String({ minLength: 1 }),
  }),
  attributes: PublicApartmentAttributesSchema,
  imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export const PublicApartmentListingListResponseSchema = Type.Object({
  items: Type.Array(PublicApartmentListingItemSchema),
  nextCursor: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export const PublicApartmentListingDetailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  type: Type.Union([Type.Literal('apartment_sale'), Type.Literal('apartment_rent')]),
  title: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  priceAmount: Type.Number({ minimum: 1 }),
  currency: Type.Literal('TRY'),
  roomCount: ApartmentRoomCountSchema,
  grossM2: Type.Integer({ minimum: 1 }),
  netM2: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  buildingAge: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  floor: Type.Union([Type.Integer(), Type.Null()]),
  totalFloors: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  location: Type.Object({
    provinceName: Type.String({ minLength: 1 }),
    districtName: Type.String({ minLength: 1 }),
    neighborhoodName: Type.String({ minLength: 1 }),
  }),
  attributes: PublicApartmentAttributesSchema,
  images: Type.Array(Type.Object({
    id: Type.String({ format: 'uuid' }),
    sortOrder: Type.Integer({ minimum: 0 }),
    cardUrl: Type.String({ minLength: 1 }),
    fullUrl: Type.String({ minLength: 1 }),
  })),
  contact: Type.Object({ showPhone: Type.Boolean() }),
})

export const PublicApartmentListingDetailResponseSchema = Type.Object({
  listing: PublicApartmentListingDetailSchema,
})

export const PublicApartmentListingContactResponseSchema = Type.Object({
  phoneE164: Type.String({ pattern: '^\\+90[0-9]{10}$' }),
})

export const PublicApartmentListingSortSchema = Type.Union([
  Type.Literal('newest'),
  Type.Literal('oldest'),
  Type.Literal('price_asc'),
  Type.Literal('price_desc'),
  Type.Literal('gross_m2_asc'),
  Type.Literal('gross_m2_desc'),
])

export const ApartmentOwnerListingSummarySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  type: Type.Union([Type.Literal('apartment_sale'), Type.Literal('apartment_rent')]),
  status: Type.Union([
    Type.Literal('draft'),
    Type.Literal('pending_verification'),
    Type.Literal('pending_review'),
    Type.Literal('published'),
    Type.Literal('rejected'),
    Type.Literal('inactive'),
  ]),
  title: Type.Union([Type.String(), Type.Null()]),
  priceAmount: Type.Union([Type.Number({ minimum: 1 }), Type.Null()]),
  currency: Type.Union([Type.Literal('TRY'), Type.Null()]),
  roomCount: Type.Union([ApartmentRoomCountSchema, Type.Null()]),
  grossM2: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  location: Type.Object({
    provinceName: Type.Union([Type.String(), Type.Null()]),
    districtName: Type.Union([Type.String(), Type.Null()]),
  }),
  imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  updatedAt: Type.String({ minLength: 1 }),
  publishedAt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export const ApartmentOwnerListingListResponseSchema = Type.Object({
  items: Type.Array(ApartmentOwnerListingSummarySchema),
})

export const PublishApartmentDraftResponseSchema = Type.Object({
  listing: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Literal('published'),
    publishedAt: Type.String({ minLength: 1 }),
  }),
})

export const UnpublishApartmentDraftResponseSchema = Type.Object({
  listing: Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.Literal('inactive'),
  }),
})

export type ApartmentTransactionType = Static<typeof ApartmentTransactionTypeSchema>
export type CreateApartmentDraftRequest = Static<typeof CreateApartmentDraftRequestSchema>
export type UpdateApartmentDraftDetailsRequest = Static<typeof UpdateApartmentDraftDetailsRequestSchema>
export type ApartmentDraftResponse = Static<typeof ApartmentDraftResponseSchema>
export type PublicApartmentListingListResponse = Static<typeof PublicApartmentListingListResponseSchema>
export type PublicApartmentListingDetailResponse = Static<typeof PublicApartmentListingDetailResponseSchema>
export type PublicApartmentListingContactResponse = Static<typeof PublicApartmentListingContactResponseSchema>
export type PublicApartmentListingSort = Static<typeof PublicApartmentListingSortSchema>
export type ApartmentOwnerListingListResponse = Static<typeof ApartmentOwnerListingListResponseSchema>
export type PublishApartmentDraftResponse = Static<typeof PublishApartmentDraftResponseSchema>
export type UnpublishApartmentDraftResponse = Static<typeof UnpublishApartmentDraftResponseSchema>
