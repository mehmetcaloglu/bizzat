import {
  ApiErrorResponseSchema,
  CarBodyTypeSchema,
  CarDrivetrainSchema,
  CarFuelTypeSchema,
  CarSaleDraftResponseSchema,
  CarTransmissionSchema,
  CarVehicleConditionSchema,
  CreateCarSaleDraftRequestSchema,
  OwnerCarListingListResponseSchema,
  PublicCarListingContactResponseSchema,
  PublicCarListingDetailResponseSchema,
  PublicCarListingListResponseSchema,
  PublicCarListingSortSchema,
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
import { ListingRepository, type PublicCarListingFilters } from './listing.repository.js'
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
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  cursor: Type.Optional(Type.String({ minLength: 1 })),
  sort: Type.Optional(PublicCarListingSortSchema),
  brandId: Type.Optional(Type.String({ format: 'uuid' })),
  seriesId: Type.Optional(Type.String({ format: 'uuid' })),
  modelId: Type.Optional(Type.String({ format: 'uuid' })),
  provinceId: Type.Optional(Type.String({ format: 'uuid' })),
  districtId: Type.Optional(Type.String({ format: 'uuid' })),
  minPrice: Type.Optional(Type.Number({ minimum: 1 })),
  maxPrice: Type.Optional(Type.Number({ minimum: 1 })),
  minYear: Type.Optional(Type.Integer({ minimum: 1950, maximum: 2100 })),
  maxYear: Type.Optional(Type.Integer({ minimum: 1950, maximum: 2100 })),
  minMileageKm: Type.Optional(Type.Integer({ minimum: 0 })),
  maxMileageKm: Type.Optional(Type.Integer({ minimum: 0 })),
  fuelType: Type.Optional(CarFuelTypeSchema),
  transmission: Type.Optional(CarTransmissionSchema),
  bodyType: Type.Optional(CarBodyTypeSchema),
  drivetrain: Type.Optional(CarDrivetrainSchema),
  vehicleCondition: Type.Optional(CarVehicleConditionSchema),
  color: Type.Optional(Type.String({ minLength: 2, maxLength: 40 })),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  swapAvailable: Type.Optional(Type.Boolean()),
  listedWithinDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
}, { additionalProperties: false })

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
  }, async (request) => {
    const filters: PublicCarListingFilters = {}
    if (request.query.brandId) filters.brandId = request.query.brandId
    if (request.query.seriesId) filters.seriesId = request.query.seriesId
    if (request.query.modelId) filters.modelId = request.query.modelId
    if (request.query.provinceId) filters.provinceId = request.query.provinceId
    if (request.query.districtId) filters.districtId = request.query.districtId
    if (request.query.minPrice !== undefined) filters.minPrice = request.query.minPrice
    if (request.query.maxPrice !== undefined) filters.maxPrice = request.query.maxPrice
    if (request.query.minYear !== undefined) filters.minYear = request.query.minYear
    if (request.query.maxYear !== undefined) filters.maxYear = request.query.maxYear
    if (request.query.minMileageKm !== undefined) filters.minMileageKm = request.query.minMileageKm
    if (request.query.maxMileageKm !== undefined) filters.maxMileageKm = request.query.maxMileageKm
    if (request.query.fuelType) filters.fuelType = request.query.fuelType
    if (request.query.transmission) filters.transmission = request.query.transmission
    if (request.query.bodyType) filters.bodyType = request.query.bodyType
    if (request.query.drivetrain) filters.drivetrain = request.query.drivetrain
    if (request.query.vehicleCondition) filters.vehicleCondition = request.query.vehicleCondition
    if (request.query.color) filters.color = request.query.color
    if (request.query.q) filters.q = request.query.q
    if (request.query.swapAvailable !== undefined) filters.swapAvailable = request.query.swapAvailable
    if (request.query.listedWithinDays !== undefined) {
      filters.listedWithinDays = request.query.listedWithinDays
    }

    return await service.listPublicCarListings({
      limit: request.query.limit ?? 12,
      sort: request.query.sort ?? 'newest',
      ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
      filters,
    })
  })

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
