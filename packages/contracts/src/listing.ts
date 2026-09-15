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
}, { additionalProperties: false })

export const CarSaleDraftSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: Type.Literal('draft'),
  type: Type.Literal('car_sale'),
  vehicle: CarSaleDraftVehicleSummarySchema,
  details: Type.Union([CarSaleDraftCoreDetailsSchema, Type.Null()]),
})

export const CarSaleDraftResponseSchema = Type.Object({
  listing: CarSaleDraftSchema,
})

export type CreateCarSaleDraftRequest = Static<typeof CreateCarSaleDraftRequestSchema>
export type UpdateCarSaleDraftCoreDetailsRequest = Static<typeof UpdateCarSaleDraftCoreDetailsRequestSchema>
export type CarSaleDraftResponse = Static<typeof CarSaleDraftResponseSchema>
