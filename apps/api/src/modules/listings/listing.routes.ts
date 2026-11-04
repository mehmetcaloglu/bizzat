import {
  ApiErrorResponseSchema,
  CarSaleDraftResponseSchema,
  CreateCarSaleDraftRequestSchema,
  OwnerCarListingListResponseSchema,
  PublicCarListingContactResponseSchema,
  PublicCarListingDetailResponseSchema,
  PublicCarListingListResponseSchema,
  PublishCarSaleDraftResponseSchema,
  UnpublishCarSaleDraftResponseSchema,
  UpdateCarSaleDraftCoreDetailsRequestSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { BizzatAuth } from '../../auth/auth.js'
import { getAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { LocationRepository } from '../../reference/location.repository.js'
import { LocationService } from '../../reference/location.service.js'
import { VehicleCatalogRepository } from '../../reference/vehicle/vehicle-catalog.repository.js'
import { VehicleCatalogService } from '../../reference/vehicle/vehicle-catalog.service.js'
import type { VerificationProvider } from '../verifications/verification.provider.js'
import { ListingRepository } from './listing.repository.js'
import { ListingService } from './listing.service.js'

export interface ListingRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
  verificationProvider: VerificationProvider
}

const ListingParamsSchema = Type.Object({
  listingId: Type.String({ format: 'uuid' }),
})

const ListingImageParamsSchema = Type.Object({
  listingId: Type.String({ format: 'uuid' }),
  imageId: Type.String({ format: 'uuid' }),
})

const PublicImageParamsSchema = Type.Object({
  imageId: Type.String({ format: 'uuid' }),
})

const PublicListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
  cursor: Type.Optional(Type.String({ minLength: 1 })),
})

export const listingRoutes: FastifyPluginAsyncTypebox<ListingRoutesOptions> = async (
  app,
  options,
) => {
  app.addContentTypeParser(
    /^image\/(jpeg|png|webp)$/,
    { parseAs: 'buffer', bodyLimit: 8_000_000 },
    (_request, body, done) => done(null, body),
  )

  const service = new ListingService(
    options.db,
    new ListingRepository(options.db),
    new VehicleCatalogService(new VehicleCatalogRepository(options.db)),
    new LocationService(new LocationRepository(options.db)),
    options.verificationProvider,
  )

  app.get('/listings/public/car-sale', {
    schema: {
      querystring: PublicListQuerySchema,
      response: {
        200: PublicCarListingListResponseSchema,
      },
    },
  }, async (request) => service.listPublicCarListings(
    request.query.limit ?? 12,
    request.query.cursor,
  ))

  app.get('/listings/public/car-sale/:listingId', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublicCarListingDetailResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const listing = await service.getPublicCarListing(request.params.listingId)
    return reply
      .header('Cache-Control', 'public, max-age=60')
      .send(listing)
  })

  app.get('/listings/public/car-sale/:listingId/contact', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublicCarListingContactResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const contact = await service.getPublicCarListingContact(request.params.listingId)
    return reply
      .header('Cache-Control', 'no-store')
      .send(contact)
  })

  app.get('/listings/public/images/:imageId', {
    schema: {
      params: PublicImageParamsSchema,
    },
  }, async (request, reply) => {
    const image = await service.readPublicImage(request.params.imageId)
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(image.mimeType)
      .send(image.bytes)
  })

  app.get('/listings/public/images/:imageId/full', {
    schema: {
      params: PublicImageParamsSchema,
    },
  }, async (request, reply) => {
    const image = await service.readPublicImage(request.params.imageId, 'full')
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type(image.mimeType)
      .send(image.bytes)
  })

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

  app.get('/me/listings', {
    schema: {
      response: {
        200: OwnerCarListingListResponseSchema,
        401: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    return await service.listMyCarListings(session.user.id)
  })

  app.post('/listings/:listingId/publish', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublishCarSaleDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
        503: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    return await service.publishCarSaleListing(session.user.id, request.params.listingId)
  })

  app.post('/listings/:listingId/unpublish', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: UnpublishCarSaleDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    return await service.unpublishCarSaleListing(session.user.id, request.params.listingId)
  })

  app.patch('/listings/:listingId/car-sale/details', {
    schema: {
      params: ListingParamsSchema,
      body: UpdateCarSaleDraftCoreDetailsRequestSchema,
      response: {
        200: CarSaleDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }

    return {
      listing: await service.updateCarSaleDraftCoreDetails(
        session.user.id,
        request.params.listingId,
        request.body,
      ),
    }
  })

  app.post('/listings/:listingId/images', {
    schema: {
      params: ListingParamsSchema,
      response: {
        201: CarSaleDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')

    const contentType = request.headers['content-type']?.split(';', 1)[0] ?? ''
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Fotoğraf verisi okunamadı.')
    }

    const listing = await service.uploadDraftImage(
      session.user.id,
      request.params.listingId,
      contentType,
      request.body,
    )
    return reply.code(201).send({ listing })
  })

  app.delete('/listings/:listingId/images/:imageId', {
    schema: {
      params: ListingImageParamsSchema,
      response: {
        200: CarSaleDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')

    return {
      listing: await service.removeDraftImage(
        session.user.id,
        request.params.listingId,
        request.params.imageId,
      ),
    }
  })

  app.patch('/listings/:listingId/images/:imageId/cover', {
    schema: {
      params: ListingImageParamsSchema,
      response: {
        200: CarSaleDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')

    return {
      listing: await service.makeDraftImageCover(
        session.user.id,
        request.params.listingId,
        request.params.imageId,
      ),
    }
  })

  app.get('/listings/:listingId/images/:imageId', {
    schema: {
      params: ListingImageParamsSchema,
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')

    const image = await service.readOwnedImage(
      session.user.id,
      request.params.listingId,
      request.params.imageId,
    )
    return reply
      .header('Cache-Control', 'private, max-age=60')
      .type(image.mimeType)
      .send(image.bytes)
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
