import { Type } from 'typebox'

export const ReferenceProvinceSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  code: Type.String(),
  name: Type.String(),
})

export const ReferenceDistrictSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceNeighborhoodSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  kind: Type.Union([Type.String(), Type.Null()]),
})

export const ReferenceProvinceListResponseSchema = Type.Object({
  items: Type.Array(ReferenceProvinceSchema),
})

export const ReferenceDistrictListResponseSchema = Type.Object({
  items: Type.Array(ReferenceDistrictSchema),
})

export const ReferenceNeighborhoodListResponseSchema = Type.Object({
  items: Type.Array(ReferenceNeighborhoodSchema),
})

export const ReferenceVehicleBrandSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleSeriesSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleModelSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleSelectionGroupSchema = Type.Object({
  key: Type.String(),
  name: Type.String(),
  kind: Type.Literal('group'),
})

export const ReferenceVehicleSelectionModelSchema = Type.Object({
  key: Type.String(),
  name: Type.String(),
  kind: Type.Literal('model'),
  id: Type.String({ format: 'uuid' }),
})

export const ReferenceVehicleSelectionItemSchema = Type.Union([
  ReferenceVehicleSelectionGroupSchema,
  ReferenceVehicleSelectionModelSchema,
])

export const ReferenceVehicleBrandListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleBrandSchema),
})

export const ReferenceVehicleSeriesListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleSeriesSchema),
})

export const ReferenceVehicleModelListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleModelSchema),
})

export const ReferenceVehicleSelectionListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleSelectionItemSchema),
})
