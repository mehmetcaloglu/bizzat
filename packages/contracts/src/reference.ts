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
