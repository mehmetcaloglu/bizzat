import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
})

afterAll(async () => {
  await db.destroy()
  await authPool.end()
})

describe('listing draft persistence', () => {
  it('creates the car_sale listing type and persists a draft with one canonical vehicle model', async () => {
    const carSale = await db
      .selectFrom('listing_types')
      .select(['id', 'code'])
      .where('code', '=', 'car_sale')
      .executeTakeFirstOrThrow()

    expect(carSale.code).toBe('car_sale')

    const userId = crypto.randomUUID()
    const email = `listing-migration-${Date.now()}@example.com`

    await db
      .insertInto('auth.user')
      .values({
        id: userId,
        name: 'Listing Migration Test',
        email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()

    const model = await db
      .selectFrom('vehicle_models')
      .select('id')
      .where('active', '=', true)
      .executeTakeFirstOrThrow()

    const listing = await db
      .insertInto('listings')
      .values({
        owner_user_id: userId,
        listing_type_id: carSale.id,
        status: 'draft',
      })
      .returning(['id', 'status'])
      .executeTakeFirstOrThrow()

    await db
      .insertInto('car_details')
      .values({
        listing_id: listing.id,
        vehicle_model_id: model.id,
      })
      .execute()

    expect(listing.status).toBe('draft')

    const detail = await db
      .selectFrom('car_details')
      .select(['listing_id', 'vehicle_model_id'])
      .where('listing_id', '=', listing.id)
      .executeTakeFirstOrThrow()

    expect(detail.vehicle_model_id).toBe(model.id)
  })

  it('rejects unsupported listing statuses', async () => {
    const carSale = await db
      .selectFrom('listing_types')
      .select('id')
      .where('code', '=', 'car_sale')
      .executeTakeFirstOrThrow()

    await expect(db
      .insertInto('listings')
      .values({
        owner_user_id: crypto.randomUUID(),
        listing_type_id: carSale.id,
        status: 'not-a-real-status',
      })
      .execute()).rejects.toThrow()
  })
})
