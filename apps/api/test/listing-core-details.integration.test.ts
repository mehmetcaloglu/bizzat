import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { buildApp } from '../src/app.js'
import { checkDatabase } from '../src/db/check.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { NormalizedLocationSnapshot } from '../src/reference/import/location-import.types.js'
import { importLocationSnapshot } from '../src/reference/import/location-importer.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)
const userIds: string[] = []
const listingIds: string[] = []
const modelIds: string[] = []
const seriesIds: string[] = []
const brandIds: string[] = []

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}

async function createSignedInUser(label: string) {
  const token = crypto.randomUUID().slice(0, 8)
  const email = `listing-details-${Date.now()}-${token}@example.com`
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

  return { userId, cookie: cookieHeader(signIn.headers['set-cookie']) }
}

async function createCanonicalModel() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brandKey = `listing-details-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Details Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Details Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  seriesIds.push(series.id)

  const model = await db.insertInto('vehicle_models')
    .values({
      series_id: series.id,
      catalog_key: modelKey,
      name: '1.0 TCe Evolution',
      active: true,
      selection_path: JSON.stringify([
        { key: `${seriesKey}:1-0-tce`, name: '1.0 TCe' },
        { key: modelKey, name: 'Evolution' },
      ]),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  modelIds.push(model.id)
  return model.id
}

function locationSnapshot(code: string): NormalizedLocationSnapshot {
  return {
    provider: { code, sourceName: 'Listing details fixture', version: '1' },
    provinces: [
      { sourceKey: '34', code: '34', name: 'İstanbul' },
      { sourceKey: '06', code: '06', name: 'Ankara' },
    ],
    districts: [
      { sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' },
      { sourceKey: '06-cankaya', provinceSourceKey: '06', name: 'Çankaya' },
    ],
    neighborhoods: [
      { sourceKey: '34-gungoren-haznedar', districtSourceKey: '34-gungoren', name: 'Haznedar', kind: 'mahalle' },
      { sourceKey: '06-cankaya-balgat', districtSourceKey: '06-cankaya', name: 'Balgat', kind: 'mahalle' },
    ],
  }
}

async function createLocations() {
  const imported = await importLocationSnapshot(db, locationSnapshot(`listing-details-${crypto.randomUUID()}`))
  const rows = await sql<{
    province_id: string
    district_id: string
    neighborhood_id: string
    province_code: string
  }>`
    select p.id as province_id, d.id as district_id, n.id as neighborhood_id, p.code as province_code
    from provinces p
    join districts d on d.province_id = p.id
    join neighborhoods n on n.district_id = d.id
    where p.provider_id = ${imported.providerId}::uuid
    order by p.code
  `.execute(db)

  const ankara = rows.rows.find((row) => row.province_code === '06')
  const istanbul = rows.rows.find((row) => row.province_code === '34')
  if (!ankara || !istanbul) throw new Error('location fixture missing')
  return { ankara, istanbul }
}

async function createDraft(cookie: string, vehicleModelId: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/listings/car-sale/drafts',
    headers: { cookie, host: 'localhost:3000' },
    payload: { vehicleModelId },
  })
  expect(response.statusCode).toBe(201)
  const id = response.json().listing.id as string
  listingIds.push(id)
  return id
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
  if (listingIds.length > 0) {
    await db.deleteFrom('car_details').where('listing_id', 'in', listingIds).execute()
    await db.deleteFrom('listings').where('id', 'in', listingIds.splice(0)).execute()
  }
  if (modelIds.length > 0) await db.deleteFrom('vehicle_models').where('id', 'in', modelIds.splice(0)).execute()
  if (seriesIds.length > 0) await db.deleteFrom('vehicle_series').where('id', 'in', seriesIds.splice(0)).execute()
  if (brandIds.length > 0) await db.deleteFrom('vehicle_brands').where('id', 'in', brandIds.splice(0)).execute()
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('car sale draft core details', () => {
  it('saves owned draft details and returns the persisted location hierarchy', async () => {
    const user = await createSignedInUser('Core Details Owner')
    const modelId = await createCanonicalModel()
    const { istanbul } = await createLocations()
    const listingId = await createDraft(user.cookie, modelId)
    const description = 'Bakımları zamanında yapılmış, günlük kullanılan temiz aile aracıdır.'

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/car-sale/details`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
      payload: {
        modelYear: new Date().getFullYear(),
        mileageKm: 42800,
        priceAmount: 1250000,
        provinceId: istanbul.province_id,
        districtId: istanbul.district_id,
        neighborhoodId: istanbul.neighborhood_id,
        description,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().listing.details).toEqual({
      modelYear: new Date().getFullYear(),
      mileageKm: 42800,
      priceAmount: 1250000,
      currency: 'TRY',
      description,
      location: {
        province: { id: istanbul.province_id, name: 'İstanbul' },
        district: { id: istanbul.district_id, name: 'Güngören' },
        neighborhood: { id: istanbul.neighborhood_id, name: 'Haznedar' },
      },
    })

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual(response.json())

    const persisted = await sql<{
      description: string
      price_amount: string
      currency: string
      province_id: string
      district_id: string
      neighborhood_id: string
      model_year: number
      mileage_km: number
    }>`
      select l.description, l.price_amount, l.currency, l.province_id, l.district_id,
             l.neighborhood_id, c.model_year, c.mileage_km
      from listings l
      join car_details c on c.listing_id = l.id
      where l.id = ${listingId}::uuid
    `.execute(db)

    expect(persisted.rows[0]).toMatchObject({
      description,
      price_amount: '1250000.00',
      currency: 'TRY',
      province_id: istanbul.province_id,
      district_id: istanbul.district_id,
      neighborhood_id: istanbul.neighborhood_id,
      model_year: new Date().getFullYear(),
      mileage_km: 42800,
    })
  })

  it('rejects location ids that do not belong to the same active hierarchy', async () => {
    const user = await createSignedInUser('Invalid Location Owner')
    const modelId = await createCanonicalModel()
    const { ankara, istanbul } = await createLocations()
    const listingId = await createDraft(user.cookie, modelId)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/car-sale/details`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
      payload: {
        modelYear: 2024,
        mileageKm: 12000,
        priceAmount: 990000,
        provinceId: istanbul.province_id,
        districtId: ankara.district_id,
        neighborhoodId: ankara.neighborhood_id,
        description: 'Konum hiyerarşisi hatasını doğrulamak için yeterince uzun açıklama.',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('LISTING_LOCATION_INVALID')
  })

  it('hides another users draft during details update', async () => {
    const owner = await createSignedInUser('Core Details Owner A')
    const other = await createSignedInUser('Core Details Owner B')
    const modelId = await createCanonicalModel()
    const { istanbul } = await createLocations()
    const listingId = await createDraft(owner.cookie, modelId)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/car-sale/details`,
      headers: { cookie: other.cookie, host: 'localhost:3000' },
      payload: {
        modelYear: 2023,
        mileageKm: 50000,
        priceAmount: 850000,
        provinceId: istanbul.province_id,
        districtId: istanbul.district_id,
        neighborhoodId: istanbul.neighborhood_id,
        description: 'Başka kullanıcının taslağı değiştirilememeli ve varlığı sızmamalıdır.',
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('LISTING_NOT_FOUND')
  })

  it('rejects details updates once the listing is no longer a draft', async () => {
    const user = await createSignedInUser('Locked Draft Owner')
    const modelId = await createCanonicalModel()
    const { istanbul } = await createLocations()
    const listingId = await createDraft(user.cookie, modelId)
    await db.updateTable('listings').set({ status: 'pending_verification' }).where('id', '=', listingId).execute()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/car-sale/details`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
      payload: {
        modelYear: 2022,
        mileageKm: 78000,
        priceAmount: 725000,
        provinceId: istanbul.province_id,
        districtId: istanbul.district_id,
        neighborhoodId: istanbul.neighborhood_id,
        description: 'Taslak durumu dışındaki bir ilan bu endpoint üzerinden değiştirilememelidir.',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('LISTING_NOT_EDITABLE')
  })

  it('rejects a model year beyond next year', async () => {
    const user = await createSignedInUser('Invalid Year Owner')
    const modelId = await createCanonicalModel()
    const { istanbul } = await createLocations()
    const listingId = await createDraft(user.cookie, modelId)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listingId}/car-sale/details`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
      payload: {
        modelYear: new Date().getFullYear() + 2,
        mileageKm: 100,
        priceAmount: 2000000,
        provinceId: istanbul.province_id,
        districtId: istanbul.district_id,
        neighborhoodId: istanbul.neighborhood_id,
        description: 'Gelecekte mümkün olmayan model yılı fail closed olarak reddedilmelidir.',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })
})
