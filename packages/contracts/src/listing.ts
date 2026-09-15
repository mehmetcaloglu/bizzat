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

export const CreateCarSaleDraftRequestSchema = Type.Object({
  vehicleModelId: Type.String({ format: 'uuid' }),
}, { additionalProperties: false })

export const CarSaleDraftSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: Type.Literal('draft'),
  type: Type.Literal('car_sale'),
  vehicle: CarSaleDraftVehicleSummarySchema,
})

export const CarSaleDraftResponseSchema = Type.Object({
  listing: CarSaleDraftSchema,
})

export type CreateCarSaleDraftRequest = Static<typeof CreateCarSaleDraftRequestSchema>
export type CarSaleDraftResponse = Static<typeof CarSaleDraftResponseSchema>
