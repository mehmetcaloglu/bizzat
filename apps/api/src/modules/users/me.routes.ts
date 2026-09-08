import { ApiErrorResponseSchema, MeResponseSchema } from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import type { BizzatAuth } from '../../auth/auth.js'
import { getAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { ensureProfile } from './profile.repository.js'

export interface MeRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
}

export const meRoutes: FastifyPluginAsyncTypebox<MeRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/me', {
    schema: {
      response: {
        200: MeResponseSchema,
        401: ApiErrorResponseSchema,
      },
    },
  }, async (request) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }

    const profile = await ensureProfile(options.db, session.user.id)

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      profile: { role: profile.role },
    }
  })
}
