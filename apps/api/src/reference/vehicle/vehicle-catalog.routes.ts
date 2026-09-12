import {
  ApiErrorResponseSchema,
  ReferenceVehicleBrandListResponseSchema,
  ReferenceVehicleModelListResponseSchema,
  ReferenceVehicleSelectionListResponseSchema,
  ReferenceVehicleSeriesListResponseSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { Database } from '../../db/client.js'
import { VehicleCatalogRepository } from './vehicle-catalog.repository.js'
import { VehicleCatalogService } from './vehicle-catalog.service.js'

export interface VehicleCatalogRoutesOptions {
  db: Kysely<Database>
}

const BrandParamsSchema = Type.Object({
  brandId: Type.String({ format: 'uuid' }),
})

const SeriesParamsSchema = Type.Object({
  seriesId: Type.String({ format: 'uuid' }),
})

const SelectionQuerySchema = Type.Object({
  parentKey: Type.Optional(Type.String({ minLength: 1 })),
})

export const vehicleCatalogRoutes: FastifyPluginAsyncTypebox<VehicleCatalogRoutesOptions> = async (
  app,
  options,
) => {
  const service = new VehicleCatalogService(new VehicleCatalogRepository(options.db))

  app.get('/reference/vehicle/brands', {
    schema: {
      response: { 200: ReferenceVehicleBrandListResponseSchema },
    },
  }, async () => ({ items: await service.listBrands() }))

  app.get('/reference/vehicle/brands/:brandId/series', {
    schema: {
      params: BrandParamsSchema,
      response: {
        200: ReferenceVehicleSeriesListResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => ({
    items: await service.listSeries(request.params.brandId),
  }))

  app.get('/reference/vehicle/series/:seriesId/models', {
    schema: {
      params: SeriesParamsSchema,
      response: {
        200: ReferenceVehicleModelListResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => ({
    items: await service.listModels(request.params.seriesId),
  }))

  app.get('/reference/vehicle/series/:seriesId/selection', {
    schema: {
      params: SeriesParamsSchema,
      querystring: SelectionQuerySchema,
      response: {
        200: ReferenceVehicleSelectionListResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => ({
    items: await service.listSelection(request.params.seriesId, request.query.parentKey),
  }))
}
