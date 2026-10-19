import { Type, type Static } from 'typebox'

export const VehicleSelectionPathNodeSchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
})

export const CarSaleDraftVehicleSummarySchema = Type.Object({
  modelId: Type.String({ format: 'uuid' }),
  brand: Type.Object({
    id: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1 }),
  }),
  series: Type.Object({
    id: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1 }),
  }),
  selectionPath: Type.Array(VehicleSelectionPathNodeSchema, { minItems: 1 }),
})

const ListingLocationItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1 }),
})

export const CarFuelTypeSchema = Type.Union([
  Type.Literal('benzin'),
  Type.Literal('dizel'),
  Type.Literal('lpg'),
  Type.Literal('hibrit'),
  Type.Literal('elektrik'),
])

export const CarTransmissionSchema = Type.Union([
  Type.Literal('manuel'),
  Type.Literal('otomatik'),
  Type.Literal('yari_otomatik'),
])

export const CarBodyTypeSchema = Type.Union([
  Type.Literal('hatchback'),
  Type.Literal('sedan'),
  Type.Literal('station_wagon'),
  Type.Literal('suv'),
  Type.Literal('coupe'),
  Type.Literal('cabrio'),
  Type.Literal('mpv'),
  Type.Literal('diger'),
])

export const CarSaleDraftCoreDetailsSchema = Type.Object({
  modelYear: Type.Integer({ minimum: 1900, maximum: 2100 }),
  mileageKm: Type.Integer({ minimum: 0, maximum: 10_000_000 }),
  priceAmount: Type.Integer({ minimum: 1, maximum: 9_999_999_999 }),
  currency: Type.Literal('TRY'),
  description: Type.String({ minLength: 20, maxLength: 5000 }),
  location: Type.Object({
    province: ListingLocationItemSchema,
    district: ListingLocationItemSchema,
    neighborhood: ListingLocationItemSchema,
  }),
})

export const CarSaleAttributesSchema = Type.Object({
  fuelType: CarFuelTypeSchema,
  transmission: CarTransmissionSchema,
  bodyType: CarBodyTypeSchema,
  color: Type.String({ minLength: 2, maxLength: 40 }),
})

export const ListingContactSchema = Type.Object({
  phoneE164: Type.String({ pattern: '^\\+90[0-9]{10}$' }),
  showPhone: Type.Boolean(),
})

export const ListingImageSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  url: Type.String({ minLength: 1 }),
  sortOrder: Type.Integer({ minimum: 0 }),
})

export const CreateCarSaleDraftRequestSchema = Type.Object({
  vehicleModelId: Type.String({ format: 'uuid' }),
}, { additionalProperties: false })

export const UpdateCarSaleDraftCoreDetailsRequestSchema = Type.Object({
  modelYear: Type.Integer({ minimum: 1900, maximum: 2100 }),
  mileageKm: Type.Integer({ minimum: 0, maximum: 10_000_000 }),
  priceAmount: Type.Integer({ minimum: 1, maximum: 9_999_999_999 }),
  provinceId: Type.String({ format: 'uuid' }),
  districtId: Type.String({ format: 'uuid' }),
  neighborhoodId: Type.String({ format: 'uuid' }),
  description: Type.String({ minLength: 20, maxLength: 5000 }),
  title: Type.Optional(Type.String({ minLength: 10, maxLength: 120 })),
  fuelType: Type.Optional(CarFuelTypeSchema),
  transmission: Type.Optional(CarTransmissionSchema),
  bodyType: Type.Optional(CarBodyTypeSchema),
  color: Type.Optional(Type.String({ minLength: 2, maxLength: 40 })),
  contactPhoneE164: Type.Optional(Type.String({ pattern: '^\\+90[0-9]{10}$' })),
  showPhone: Type.Optional(Type.Boolean()),
}, { additionalProperties: false })

export const CarSaleDraftSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: Type.Literal('draft'),
  type: Type.Literal('car_sale'),
  vehicle: CarSaleDraftVehicleSummarySchema,
  details: Type.Union([CarSaleDraftCoreDetailsSchema, Type.Null()]),
  title: Type.Union([Type.String({ minLength: 10, maxLength: 120 }), Type.Null()]),
  attributes: Type.Union([CarSaleAttributesSchema, Type.Null()]),
  contact: Type.Union([ListingContactSchema, Type.Null()]),
  images: Type.Array(ListingImageSchema),
})

export const CarSaleDraftResponseSchema = Type.Object({
  listing: CarSaleDraftSchema,
})

export const PublicCarListingItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String({ minLength: 1 }),
  priceAmount: Type.Number({ minimum: 1 }),
  currency: Type.Literal('TRY'),
  modelYear: Type.Integer(),
  mileageKm: Type.Integer({ minimum: 0 }),
  vehicle: Type.Object({
    brandName: Type.String({ minLength: 1 }),
    seriesName: Type.String({ minLength: 1 }),
  }),
  location: Type.Object({
    provinceName: Type.String({ minLength: 1 }),
    districtName: Type.String({ minLength: 1 }),
  }),
  attributes: CarSaleAttributesSchema,
  imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export const PublicCarListingListResponseSchema = Type.Object({
  items: Type.Array(PublicCarListingItemSchema),
})

export type CreateCarSaleDraftRequest = Static<typeof CreateCarSaleDraftRequestSchema>
export type UpdateCarSaleDraftCoreDetailsRequest = Static<typeof UpdateCarSaleDraftCoreDetailsRequestSchema>
export type CarSaleDraftResponse = Static<typeof CarSaleDraftResponseSchema>
export type PublicCarListingListResponse = Static<typeof PublicCarListingListResponseSchema>
