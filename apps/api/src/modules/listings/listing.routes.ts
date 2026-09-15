import {
  ApiErrorResponseSchema,
  CarSaleDraftResponseSchema,
  CreateCarSaleDraftRequestSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { BizzatAuth } from '../../auth/auth.js'
import { getAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { VehicleCatalogRepository } from '../../reference/vehicle/vehicle-catalog.repository.js'
import { VehicleCatalogService } from '../../reference/vehicle/vehicle-catalog.service.js'
import { ListingRepository } from './listing.repository.js'
import { ListingService } from './listing.service.js'

export interface ListingRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
}

const ListingParamsSchema = Type.Object({
  listingId: Type.String({ format: 'uuid' }),
})

export const listingRoutes: FastifyPluginAsyncTypebox<ListingRoutesOptions> = async (
  app,
  options,
) => {
  const service = new ListingService(
    options.db,
    new ListingRepository(options.db),
    new VehicleCatalogService(new VehicleCatalogRepository(options.db)),
  )

  app.post('/listings/car-sale/drafts', {
    schema: {
      body: CreateCarSaleDraftRequestSchema,
      response: {
        201: CarSaleDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }

    const listing = await service.createCarSaleDraft(
      session.user.id,
      request.body.vehicleModelId,
    )

    return reply.code(201).send({ listing })
  })

  app.get('/listings/:listingId', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: CarSaleDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }

    return {
      listing: await service.getOwnedDraft(session.user.id, request.params.listingId),
    }
  })
}
