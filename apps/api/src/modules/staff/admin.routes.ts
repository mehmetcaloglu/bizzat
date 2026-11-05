import {
  AdminEnforcementListResponseSchema,
  AdminRoleRequestSchema,
  AdminRoleResponseSchema,
  AdminSummarySchema,
  ApiErrorResponseSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { BizzatAuth } from '../../auth/auth.js'
import { getActiveAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { requireAdmin } from '../moderation/moderation.authorization.js'
import { AdminRepository } from './admin.repository.js'
import { AdminService } from './admin.service.js'
import { StaffRepository } from './staff.repository.js'

export interface AdminRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
}

const UserParamsSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
})

export const adminRoutes: FastifyPluginAsyncTypebox<AdminRoutesOptions> = async (
  app,
  options,
) => {
  const service = new AdminService(
    options.db,
    new AdminRepository(options.db),
    new StaffRepository(options.db),
  )

  async function requireSuperAdmin(request: Parameters<typeof getActiveAuthSession>[2]) {
    const session = await getActiveAuthSession(options.auth, options.db, request)
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    await requireAdmin(options.db, session.user.id)
    return session
  }

  app.get('/admin/summary', {
    schema: {
      response: {
        200: AdminSummarySchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    await requireSuperAdmin(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.summary()
  })

  app.get('/admin/enforcements', {
    schema: {
      response: {
        200: AdminEnforcementListResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    await requireSuperAdmin(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.listEnforcements()
  })

  app.patch('/admin/users/:userId/role', {
    schema: {
      params: UserParamsSchema,
      body: AdminRoleRequestSchema,
      response: {
        200: AdminRoleResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await requireSuperAdmin(request.headers)
    reply.header('Cache-Control', 'no-store')
    return await service.changeRole(
      session.user.id,
      request.params.userId,
      request.body,
    )
  })
}
