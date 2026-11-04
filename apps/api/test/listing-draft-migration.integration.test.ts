import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
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
const userIds: string[] = []
const modelIds: string[] = []
const seriesIds: string[] = []
const brandIds: string[] = []

async function insertAuthUser(label: string): Promise<string> {
  const id = crypto.randomUUID()
  const email = `listing-migration-${Date.now()}-${id.slice(0, 8)}@example.com`
  await sql`
    insert into auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}::uuid, ${label}, ${email}, false, now(), now())
  `.execute(db)
  userIds.push(id)
  return id
}

async function insertCanonicalModel(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brand = await db
    .insertInto('vehicle_brands')
    .values({
      catalog_key: `listing-migration-brand:${suffix}`,
      name: `Migration Brand ${suffix}`,
      active: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db
    .insertInto('vehicle_series')
    .values({
      brand_id: brand.id,
      catalog_key: `listing-migration-brand:${suffix}:series`,
      name: `Migration Series ${suffix}`,
      active: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  seriesIds.push(series.id)

  const model = await db
    .insertInto('vehicle_models')
    .values({
      series_id: series.id,
      catalog_key: `listing-migration-brand:${suffix}:series:model`,
      name: `Migration Model ${suffix}`,
      selection_path: null,
      active: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  modelIds.push(model.id)

  return model.id
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
})

afterEach(async () => {
  const owners = userIds.splice(0)
  if (owners.length > 0) {
    const ownedListings = await db
      .selectFrom('listings')
      .select('id')
      .where('owner_user_id', 'in', owners)
      .execute()
    const ownedListingIds = ownedListings.map((listing) => listing.id)
    if (ownedListingIds.length > 0) {
      await db.deleteFrom('car_details').where('listing_id', 'in', ownedListingIds).execute()
    }
    await db.deleteFrom('listings').where('owner_user_id', 'in', owners).execute()
  }
  if (modelIds.length > 0) {
    await db.deleteFrom('vehicle_models').where('id', 'in', modelIds.splice(0)).execute()
  }
  if (seriesIds.length > 0) {
    await db.deleteFrom('vehicle_series').where('id', 'in', seriesIds.splice(0)).execute()
  }
  if (brandIds.length > 0) {
    await db.deleteFrom('vehicle_brands').where('id', 'in', brandIds.splice(0)).execute()
  }
  for (const ownerUserId of owners) {
    await sql`delete from auth."user" where id = ${ownerUserId}::uuid`.execute(db)
  }
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

    const userId = await insertAuthUser('Listing Migration Test')
    const modelId = await insertCanonicalModel()

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
        vehicle_model_id: modelId,
      })
      .execute()

    expect(listing.status).toBe('draft')

    const detail = await db
      .selectFrom('car_details')
      .select(['listing_id', 'vehicle_model_id'])
      .where('listing_id', '=', listing.id)
      .executeTakeFirstOrThrow()

    expect(detail.vehicle_model_id).toBe(modelId)
  })

  it('rejects unsupported listing statuses', async () => {
    const carSale = await db
      .selectFrom('listing_types')
      .select('id')
      .where('code', '=', 'car_sale')
      .executeTakeFirstOrThrow()
    const userId = await insertAuthUser('Invalid Status Test')

    await expect(db
      .insertInto('listings')
      .values({
        owner_user_id: userId,
        listing_type_id: carSale.id,
        status: 'not-a-real-status',
      })
      .execute()).rejects.toThrow()
  })

  it('rejects a car detail that points at a non-canonical vehicle model id', async () => {
    const carSale = await db
      .selectFrom('listing_types')
      .select('id')
      .where('code', '=', 'car_sale')
      .executeTakeFirstOrThrow()
    const userId = await insertAuthUser('Invalid Vehicle FK Test')

    const listing = await db
      .insertInto('listings')
      .values({
        owner_user_id: userId,
        listing_type_id: carSale.id,
        status: 'draft',
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    await expect(db
      .insertInto('car_details')
      .values({
        listing_id: listing.id,
        vehicle_model_id: crypto.randomUUID(),
      })
      .execute()).rejects.toThrow()
  })
})
