import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { buildApp } from '../src/app.js'
import { checkDatabase } from '../src/db/check.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  app = buildApp({
    logger: false,
    readinessCheck: () => checkDatabase(db),
    auth,
    authBaseUrl: baseUrl,
    db,
  })
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('identity lifecycle', () => {
  it('rejects anonymous /me requests with the common error shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/me' })

    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('signs up, signs in, resolves /me and signs out', async () => {
    const email = `identity-${Date.now()}@example.com`
    const password = 'correct-horse-battery-staple'

    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: baseUrl, host: 'localhost:3000' },
      payload: { name: 'Identity Test', email, password },
    })
    expect(signUp.statusCode).toBe(200)

    const user = signUp.json().user
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/)

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: baseUrl, host: 'localhost:3000' },
      payload: { name: 'Duplicate', email, password },
    })
    expect(duplicate.statusCode).toBeGreaterThanOrEqual(400)

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: baseUrl, host: 'localhost:3000' },
      payload: { email, password },
    })
    expect(signIn.statusCode).toBe(200)
    const cookie = cookieHeader(signIn.headers['set-cookie'])
    expect(cookie).toContain('session_token')

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie, host: 'localhost:3000' },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({
      user: { id: user.id, email },
      profile: { role: 'user' },
    })

    const meAgain = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie, host: 'localhost:3000' },
    })
    expect(meAgain.statusCode).toBe(200)

    const profileCount = await db
      .selectFrom('profiles')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow()
    expect(Number(profileCount.count)).toBe(1)

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie, origin: baseUrl, host: 'localhost:3000' },
    })
    expect(signOut.statusCode).toBe(200)

    const signedOutCookie = cookieHeader(signOut.headers['set-cookie'])
    const afterSignOut = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: signedOutCookie || cookie, host: 'localhost:3000' },
    })
    expect(afterSignOut.statusCode).toBe(401)
  })
})
