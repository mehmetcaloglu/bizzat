import {
  ApiErrorResponseSchema,
  ReferenceDistrictListResponseSchema,
  ReferenceNeighborhoodListResponseSchema,
  ReferenceProvinceListResponseSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from 'typebox'
import type { Kysely } from 'kysely'
import type { Database } from '../db/client.js'
import { LocationRepository } from './location.repository.js'
import { LocationService } from './location.service.js'

export interface LocationRoutesOptions {
  db: Kysely<Database>
}

const ProvinceParamsSchema = Type.Object({
  provinceId: Type.String({ format: 'uuid' }),
})

const DistrictParamsSchema = Type.Object({
  districtId: Type.String({ format: 'uuid' }),
})

export const locationRoutes: FastifyPluginAsyncTypebox<LocationRoutesOptions> = async (
  app,
  options,
) => {
  const service = new LocationService(new LocationRepository(options.db))

  app.get('/reference/provinces', {
    schema: {
      response: { 200: ReferenceProvinceListResponseSchema },
    },
  }, async () => ({ items: await service.listProvinces() }))

  app.get('/reference/provinces/:provinceId/districts', {
    schema: {
      params: ProvinceParamsSchema,
      response: {
        200: ReferenceDistrictListResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => ({
    items: await service.listDistricts(request.params.provinceId),
  }))

  app.get('/reference/districts/:districtId/neighborhoods', {
    schema: {
      params: DistrictParamsSchema,
      response: {
        200: ReferenceNeighborhoodListResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => ({
    items: await service.listNeighborhoods(request.params.districtId),
  }))
}
