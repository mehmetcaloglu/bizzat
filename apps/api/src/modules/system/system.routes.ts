import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  ReadyResponseSchema,
} from '@bizzat/contracts'
import { AppError } from '../../common/errors/app-error.js'

export interface SystemRoutesOptions {
  readinessCheck: () => Promise<void>
}

export const systemRoutes: FastifyPluginAsyncTypebox<SystemRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/health', {
    schema: { response: { 200: HealthResponseSchema } },
  }, async () => ({ status: 'ok' as const }))

  app.get('/ready', {
    schema: {
      response: {
        200: ReadyResponseSchema,
        503: ApiErrorResponseSchema,
      },
    },
  }, async () => {
    try {
      await options.readinessCheck()
    } catch {
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Servis henüz hazır değil.')
    }

    return { status: 'ready' as const, database: 'ok' as const }
  })
}
