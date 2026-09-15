import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
const userIds: string[] = []
const modelIds: string[] = []
const seriesIds: string[] = []
const brandIds: string[] = []

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}

async function createSignedInUser(label: string) {
  const token = crypto.randomUUID().slice(0, 8)
  const email = `${label}-${Date.now()}-${token}@example.com`
  const password = 'correct-horse-battery-staple'

  const signUp = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: baseUrl, host: 'localhost:3000' },
    payload: { name: label, email, password },
  })
  expect(signUp.statusCode).toBe(200)
  const userId = signUp.json().user.id as string
  userIds.push(userId)

  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: baseUrl, host: 'localhost:3000' },
    payload: { email, password },
  })
  expect(signIn.statusCode).toBe(200)

  return {
    userId,
    cookie: cookieHeader(signIn.headers['set-cookie']),
  }
}

async function createCanonicalModel(active = true) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brandKey = `listing-route-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db
    .insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Route Test', active })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db
    .insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Route Test', active })
    .returning('id')
    .executeTakeFirstOrThrow()
  seriesIds.push(series.id)

  const model = await db
    .insertInto('vehicle_models')
    .values({
      series_id: series.id,
      catalog_key: modelKey,
      name: '1.0 TCe Evolution',
      active,
      selection_path: JSON.stringify([
        { key: `${seriesKey}:1-0-tce`, name: '1.0 TCe' },
        { key: modelKey, name: 'Evolution' },
      ]),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  modelIds.push(model.id)

  return { modelId: model.id }
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
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('car sale draft API', () => {
  it('rejects anonymous draft creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/listings/car-sale/drafts',
      payload: { vehicleModelId: crypto.randomUUID() },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('creates an owned draft atomically with a terminal canonical model and returns its vehicle path', async () => {
    const user = await createSignedInUser('Draft Owner')
    const { modelId } = await createCanonicalModel()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/listings/car-sale/drafts',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
      payload: { vehicleModelId: modelId },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.listing).toMatchObject({
      status: 'draft',
      type: 'car_sale',
      vehicle: {
        modelId,
        brand: { name: 'Renault Route Test' },
        series: { name: 'Clio Route Test' },
        selectionPath: [
          { name: '1.0 TCe' },
          { name: 'Evolution' },
        ],
      },
    })

    const persisted = await db
      .selectFrom('listings')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .select(['listings.owner_user_id', 'listings.status', 'car_details.vehicle_model_id'])
      .where('listings.id', '=', body.listing.id)
      .executeTakeFirstOrThrow()

    expect(persisted).toEqual({
      owner_user_id: user.userId,
      status: 'draft',
      vehicle_model_id: modelId,
    })

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${body.listing.id}`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual(body)
  })

  it('fails closed for unknown or inactive vehicle models without creating an orphan listing', async () => {
    const user = await createSignedInUser('Invalid Vehicle Owner')
    const inactive = await createCanonicalModel(false)
    const before = await db.selectFrom('listings')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('owner_user_id', '=', user.userId)
      .executeTakeFirstOrThrow()

    for (const vehicleModelId of [inactive.modelId, crypto.randomUUID()]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/listings/car-sale/drafts',
        headers: { cookie: user.cookie, host: 'localhost:3000' },
        payload: { vehicleModelId },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VEHICLE_MODEL_NOT_AVAILABLE')
    }

    const after = await db.selectFrom('listings')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('owner_user_id', '=', user.userId)
      .executeTakeFirstOrThrow()
    expect(Number(after.count)).toBe(Number(before.count))
  })

  it('does not accept client-owned owner/status fields and hides another users draft as not found', async () => {
    const owner = await createSignedInUser('Draft Owner A')
    const other = await createSignedInUser('Draft Owner B')
    const { modelId } = await createCanonicalModel()

    const injectedOwner = await app.inject({
      method: 'POST',
      url: '/api/v1/listings/car-sale/drafts',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: {
        vehicleModelId: modelId,
        ownerUserId: other.userId,
        status: 'published',
      },
    })
    expect(injectedOwner.statusCode).toBe(400)

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/listings/car-sale/drafts',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: { vehicleModelId: modelId },
    })
    expect(created.statusCode).toBe(201)
    const listingId = created.json().listing.id as string

    const otherRead = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: other.cookie, host: 'localhost:3000' },
    })
    expect(otherRead.statusCode).toBe(404)
    expect(otherRead.json().error.code).toBe('LISTING_NOT_FOUND')
  })
})
