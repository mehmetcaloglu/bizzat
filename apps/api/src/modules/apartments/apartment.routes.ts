import {
  ApartmentDraftResponseSchema,
  ApartmentHeatingSchema,
  ApartmentOwnerListingListResponseSchema,
  ApartmentParkingSchema,
  ApartmentRoomCountSchema,
  ApartmentTransactionTypeSchema,
  ApiErrorResponseSchema,
  CreateApartmentDraftRequestSchema,
  PublicApartmentListingContactResponseSchema,
  PublicApartmentListingDetailResponseSchema,
  PublicApartmentListingListResponseSchema,
  PublicApartmentListingSortSchema,
  PublishApartmentDraftResponseSchema,
  UnpublishApartmentDraftResponseSchema,
  UpdateApartmentDraftDetailsRequestSchema,
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
import type { VerificationProvider } from '../verifications/verification.provider.js'
import {
  ListingRepository,
  type ApartmentFeedFilters,
} from '../listings/listing.repository.js'
import { ApartmentService } from './apartment.service.js'

export interface ApartmentRoutesOptions {
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

const PublicApartmentQuerySchema = Type.Object({
  transactionType: Type.Optional(ApartmentTransactionTypeSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  cursor: Type.Optional(Type.String({ minLength: 1 })),
  sort: Type.Optional(PublicApartmentListingSortSchema),
  provinceId: Type.Optional(Type.String({ format: 'uuid' })),
  districtId: Type.Optional(Type.String({ format: 'uuid' })),
  minPrice: Type.Optional(Type.Number({ minimum: 1 })),
  maxPrice: Type.Optional(Type.Number({ minimum: 1 })),
  roomCount: Type.Optional(ApartmentRoomCountSchema),
  minGrossM2: Type.Optional(Type.Integer({ minimum: 1 })),
  maxGrossM2: Type.Optional(Type.Integer({ minimum: 1 })),
  minBuildingAge: Type.Optional(Type.Integer({ minimum: 0, maximum: 200 })),
  maxBuildingAge: Type.Optional(Type.Integer({ minimum: 0, maximum: 200 })),
  minFloor: Type.Optional(Type.Integer({ minimum: -10, maximum: 200 })),
  maxFloor: Type.Optional(Type.Integer({ minimum: -10, maximum: 200 })),
  heating: Type.Optional(ApartmentHeatingSchema),
  bathroomCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 20 })),
  furnished: Type.Optional(Type.Boolean()),
  inSite: Type.Optional(Type.Boolean()),
  parking: Type.Optional(ApartmentParkingSchema),
  creditEligible: Type.Optional(Type.Boolean()),
  swapAvailable: Type.Optional(Type.Boolean()),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  listedWithinDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
}, { additionalProperties: false })

async function requireSession(
  auth: BizzatAuth,
  headers: Record<string, string | string[] | undefined>,
) {
  const session = await getAuthSession(auth, headers)
  if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
  return session
}

export const apartmentRoutes: FastifyPluginAsyncTypebox<ApartmentRoutesOptions> = async (
  app,
  options,
) => {
  app.addContentTypeParser(
    /^image\/(jpeg|png|webp)$/,
    { parseAs: 'buffer', bodyLimit: 8_000_000 },
    (_request, body, done) => done(null, body),
  )

  const service = new ApartmentService(
    options.db,
    new ListingRepository(options.db),
    new LocationService(new LocationRepository(options.db)),
    options.verificationProvider,
  )

  app.post('/listings/apartment/drafts', {
    schema: {
      body: CreateApartmentDraftRequestSchema,
      response: {
        201: ApartmentDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireSession(options.auth, request.headers)
    const listing = await service.createDraft(session.user.id, request.body.transactionType)
    return reply.code(201).send({ listing })
  })

  app.get('/listings/:listingId/apartment', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: ApartmentDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return { listing: await service.getOwnedDraft(session.user.id, request.params.listingId) }
  })

  app.patch('/listings/:listingId/apartment-details', {
    schema: {
      params: ListingParamsSchema,
      body: UpdateApartmentDraftDetailsRequestSchema,
      response: {
        200: ApartmentDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return {
      listing: await service.updateDetails(
        session.user.id,
        request.params.listingId,
        request.body,
      ),
    }
  })

  app.post('/listings/:listingId/apartment/images', {
    schema: {
      params: ListingParamsSchema,
      response: {
        201: ApartmentDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireSession(options.auth, request.headers)
    const mimeType = request.headers['content-type'] ?? ''
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Yalnız JPEG, PNG veya WebP yükleyebilirsin.')
    }
    const listing = await service.uploadDraftImage(
      session.user.id,
      request.params.listingId,
      mimeType,
      request.body as Buffer,
    )
    return reply.code(201).send({ listing })
  })

  app.delete('/listings/:listingId/apartment/images/:imageId', {
    schema: {
      params: ListingImageParamsSchema,
      response: {
        200: ApartmentDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return {
      listing: await service.removeDraftImage(
        session.user.id,
        request.params.listingId,
        request.params.imageId,
      ),
    }
  })

  app.patch('/listings/:listingId/apartment/images/:imageId/cover', {
    schema: {
      params: ListingImageParamsSchema,
      response: {
        200: ApartmentDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return {
      listing: await service.makeDraftImageCover(
        session.user.id,
        request.params.listingId,
        request.params.imageId,
      ),
    }
  })

  app.post('/listings/:listingId/apartment/publish', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublishApartmentDraftResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
        503: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return await service.publishOwnedListing(session.user.id, request.params.listingId)
  })

  app.post('/listings/:listingId/apartment/unpublish', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: UnpublishApartmentDraftResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return await service.unpublishOwnedListing(session.user.id, request.params.listingId)
  })

  app.get('/me/apartment-listings', {
    schema: {
      response: {
        200: ApartmentOwnerListingListResponseSchema,
        401: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await requireSession(options.auth, request.headers)
    return await service.listOwned(session.user.id)
  })

  app.get('/listings/public/apartment', {
    schema: {
      querystring: PublicApartmentQuerySchema,
      response: {
        200: PublicApartmentListingListResponseSchema,
        400: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const filters: ApartmentFeedFilters = {
      transactionType: request.query.transactionType ?? 'sale',
    }
    if (request.query.provinceId) filters.provinceId = request.query.provinceId
    if (request.query.districtId) filters.districtId = request.query.districtId
    if (request.query.minPrice !== undefined) filters.minPrice = request.query.minPrice
    if (request.query.maxPrice !== undefined) filters.maxPrice = request.query.maxPrice
    if (request.query.roomCount) filters.roomCount = request.query.roomCount
    if (request.query.minGrossM2 !== undefined) filters.minGrossM2 = request.query.minGrossM2
    if (request.query.maxGrossM2 !== undefined) filters.maxGrossM2 = request.query.maxGrossM2
    if (request.query.minBuildingAge !== undefined) {
      filters.minBuildingAge = request.query.minBuildingAge
    }
    if (request.query.maxBuildingAge !== undefined) {
      filters.maxBuildingAge = request.query.maxBuildingAge
    }
    if (request.query.minFloor !== undefined) filters.minFloor = request.query.minFloor
    if (request.query.maxFloor !== undefined) filters.maxFloor = request.query.maxFloor
    if (request.query.heating) filters.heating = request.query.heating
    if (request.query.bathroomCount !== undefined) {
      filters.bathroomCount = request.query.bathroomCount
    }
    if (request.query.furnished !== undefined) filters.furnished = request.query.furnished
    if (request.query.inSite !== undefined) filters.inSite = request.query.inSite
    if (request.query.parking) filters.parking = request.query.parking
    if (request.query.creditEligible !== undefined) {
      filters.creditEligible = request.query.creditEligible
    }
    if (request.query.swapAvailable !== undefined) {
      filters.swapAvailable = request.query.swapAvailable
    }
    if (request.query.q) filters.q = request.query.q
    if (request.query.listedWithinDays !== undefined) {
      filters.listedWithinDays = request.query.listedWithinDays
    }

    return await service.listPublic({
      limit: request.query.limit ?? 12,
      sort: request.query.sort ?? 'newest',
      ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
      filters,
    })
  })

  app.get('/listings/public/apartment/:listingId', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublicApartmentListingDetailResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const listing = await service.getPublic(request.params.listingId)
    return reply.header('Cache-Control', 'public, max-age=60').send(listing)
  })

  app.get('/listings/public/apartment/:listingId/contact', {
    schema: {
      params: ListingParamsSchema,
      response: {
        200: PublicApartmentListingContactResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const contact = await service.getPublicContact(request.params.listingId)
    return reply.header('Cache-Control', 'no-store').send(contact)
  })
}
