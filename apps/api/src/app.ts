import type { Kysely } from 'kysely'
import Fastify, { type FastifyInstance } from 'fastify'
import type { BizzatAuth } from './auth/auth.js'
import { authRoutes } from './auth/auth.routes.js'
import { registerErrorHandling } from './common/errors/error-handler.js'
import type { Database } from './db/client.js'
import { systemRoutes } from './modules/system/system.routes.js'
import { meRoutes } from './modules/users/me.routes.js'
import { locationRoutes } from './reference/location.routes.js'
import { vehicleCatalogRoutes } from './reference/vehicle/vehicle-catalog.routes.js'

export interface BuildAppOptions {
  readinessCheck: () => Promise<void>
  auth?: BizzatAuth
  authBaseUrl?: string
  db?: Kysely<Database>
  logger?: boolean
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true })

  registerErrorHandling(app)
  app.register(systemRoutes, {
    prefix: '/api/v1',
    readinessCheck: options.readinessCheck,
  })

  if (options.db) {
    app.register(locationRoutes, {
      prefix: '/api/v1',
      db: options.db,
    })
    app.register(vehicleCatalogRoutes, {
      prefix: '/api/v1',
      db: options.db,
    })
  }

  if (options.auth && options.authBaseUrl && options.db) {
    app.register(authRoutes, {
      auth: options.auth,
      baseUrl: options.authBaseUrl,
    })
    app.register(meRoutes, {
      prefix: '/api/v1',
      auth: options.auth,
      db: options.db,
    })
  }

  return app
}
