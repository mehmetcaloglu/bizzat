import {
  ApiErrorResponseSchema,
  StaffListingTakedownResponseSchema,
  StaffReasonRequestSchema,
  StaffSuspendRequestSchema,
  StaffUserActionResponseSchema,
  StaffUserDetailResponseSchema,
  StaffUserListResponseSchema,
  StaffUserQuerySchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { BizzatAuth } from '../../auth/auth.js'
import { getActiveAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { requireModerator } from '../moderation/moderation.authorization.js'
import { StaffRepository } from './staff.repository.js'
import { StaffService } from './staff.service.js'

export interface StaffRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
}

const UserParamsSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
})

const ListingParamsSchema = Type.Object({
  listingId: Type.String({ format: 'uuid' }),
})

export const staffRoutes: FastifyPluginAsyncTypebox<StaffRoutesOptions> = async (
  app,
  options,
) => {
  const service = new StaffService(options.db, new StaffRepository(options.db))

  async function requireStaff(request: Parameters<typeof getActiveAuthSession>[2]) {
    const session = await getActiveAuthSession(options.auth, options.db, request)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    await requireModerator(options.db, session.user.id)
    return session
  }

  app.get('/staff/users', {
    schema: {
      querystring: StaffUserQuerySchema,
      response: {
        200: StaffUserListResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.searchUsers(request.query.q)
  })

  app.get('/staff/users/:userId', {
    schema: {
      params: UserParamsSchema,
      response: {
        200: StaffUserDetailResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.getUserDetail(request.params.userId)
  })

  app.post('/staff/users/:userId/warnings', {
    schema: {
      params: UserParamsSchema,
      body: StaffReasonRequestSchema,
      response: {
        200: StaffUserActionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.warnUser(session.user.id, request.params.userId, request.body)
  })

  app.post('/staff/users/:userId/suspend', {
    schema: {
      params: UserParamsSchema,
      body: StaffSuspendRequestSchema,
      response: {
        200: StaffUserActionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.suspendUser(session.user.id, request.params.userId, request.body)
  })

  app.post('/staff/users/:userId/ban', {
    schema: {
      params: UserParamsSchema,
      body: StaffReasonRequestSchema,
      response: {
        200: StaffUserActionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.banUser(session.user.id, request.params.userId, request.body)
  })

  app.post('/staff/users/:userId/reactivate', {
    schema: {
      params: UserParamsSchema,
      body: StaffReasonRequestSchema,
      response: {
        200: StaffUserActionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.reactivateUser(session.user.id, request.params.userId, request.body)
  })

  app.post('/staff/listings/:listingId/takedown', {
    schema: {
      params: ListingParamsSchema,
      body: StaffReasonRequestSchema,
      response: {
        200: StaffListingTakedownResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireStaff(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.takedownListing(
      session.user.id,
      request.params.listingId,
      request.body,
    )
  })
}
