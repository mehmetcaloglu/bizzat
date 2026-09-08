import { betterAuth } from 'better-auth'
import pg from 'pg'

const { Pool } = pg

export interface AuthConfig {
  databaseUrl: string
  baseUrl: string
  secret: string
}

function withAuthSearchPath(connectionString: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('options', '-c search_path=auth')
  return url.toString()
}

export function createAuthPool(databaseUrl: string): pg.Pool {
  return new Pool({
    connectionString: withAuthSearchPath(databaseUrl),
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
  })
}

export function createAuth(config: AuthConfig, pool: pg.Pool = createAuthPool(config.databaseUrl)) {
  return betterAuth({
    appName: 'Bizzat',
    baseURL: config.baseUrl,
    basePath: '/api/auth',
    secret: config.secret,
    database: pool,
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      database: {
        generateId: 'uuid',
        joins: true,
      },
    },
  })
}

export type BizzatAuth = ReturnType<typeof createAuth>
