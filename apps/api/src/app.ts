import Fastify, { type FastifyInstance } from 'fastify'
import { registerErrorHandling } from './common/errors/error-handler.js'
import { systemRoutes } from './modules/system/system.routes.js'

export interface BuildAppOptions {
  readinessCheck: () => Promise<void>
  logger?: boolean
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true })

  registerErrorHandling(app)
  app.register(systemRoutes, {
    prefix: '/api/v1',
    readinessCheck: options.readinessCheck,
  })

  return app
}
