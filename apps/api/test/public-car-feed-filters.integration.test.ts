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
const userId = crypto.randomUUID()
const listingIds: string[] = []
const modelIds: string[] = []
const seriesIds: string[] = []
const brandIds: string[] = []

interface FeedFixture {
  id: string
  title: string
  brand: 'renault' | 'fiat'
  series: 'clio' | 'egea'
  model: 'clio-model' | 'egea-model'
  priceAmount: string
  modelYear: number
  mileageKm: number
  fuelType: string
  transmission: string
  bodyType: string
  drivetrain: string
  vehicleCondition: string
  color: string
  swapAvailable: boolean
  location: 'istanbul' | 'ankara'
  publishedAt: Date
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return query.toString()
}

function locationSnapshot(): NormalizedLocationSnapshot {
  return {
    provider: { code: `feed-filter-${crypto.randomUUID()}`, sourceName: 'Feed filter fixture', version: '1' },
    provinces: [
      { sourceKey: '34', code: '34', name: 'İstanbul' },
      { sourceKey: '06', code: '06', name: 'Ankara' },
    ],
    districts: [
      { sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' },
      { sourceKey: '06-cankaya', provinceSourceKey: '06', name: 'Çankaya' },
    ],
    neighborhoods: [
      {
        sourceKey: '34-gungoren-haznedar',
        districtSourceKey: '34-gungoren',
        name: 'Haznedar',
        kind: 'mahalle',
      },
      {
        sourceKey: '06-cankaya-kizilay',
        districtSourceKey: '06-cankaya',
        name: 'Kızılay',
        kind: 'mahalle',
      },
    ],
  }
}

async function createVehicleFixture() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brands = new Map<string, string>()
  const series = new Map<string, string>()
  const models = new Map<string, string>()

  for (const [slug, name] of [['renault', 'Renault'], ['fiat', 'Fiat']] as const) {
    const row = await db.insertInto('vehicle_brands')
      .values({ catalog_key: `feed-filter:${slug}:${suffix}`, name, active: true })
      .returning('id')
      .executeTakeFirstOrThrow()
    brands.set(slug, row.id)
    brandIds.push(row.id)
  }

  for (const [slug, brandSlug, name] of [
    ['clio', 'renault', 'Clio'],
    ['egea', 'fiat', 'Egea'],
  ] as const) {
    const row = await db.insertInto('vehicle_series')
      .values({
        brand_id: brands.get(brandSlug)!,
        catalog_key: `feed-filter:${slug}:${suffix}`,
        name,
        active: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    series.set(slug, row.id)
    seriesIds.push(row.id)
  }

  for (const [slug, seriesSlug, name] of [
    ['clio-model', 'clio', '1.0 TCe Evolution'],
    ['egea-model', 'egea', '1.4 Fire Urban'],
  ] as const) {
    const row = await db.insertInto('vehicle_models')
      .values({
        series_id: series.get(seriesSlug)!,
        catalog_key: `feed-filter:${slug}:${suffix}:0`,
        name,
        active: true,
        selection_path: JSON.stringify([{ key: `feed-filter:${slug}:${suffix}:0`, name }]),
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    models.set(slug, row.id)
    modelIds.push(row.id)
  }

  const imported = await importLocationSnapshot(db, locationSnapshot())
  const locations = await sql<{
    istanbul_province: string
    istanbul_district: string
    istanbul_neighborhood: string
    ankara_province: string
    ankara_district: string
    ankara_neighborhood: string
  }>`
    select
      istanbul.id::text as istanbul_province,
      istanbul_district.id::text as istanbul_district,
      istanbul_neighborhood.id::text as istanbul_neighborhood,
      ankara.id::text as ankara_province,
      ankara_district.id::text as ankara_district,
      ankara_neighborhood.id::text as ankara_neighborhood
    from provinces istanbul
    join districts istanbul_district on istanbul_district.province_id = istanbul.id
    join neighborhoods istanbul_neighborhood on istanbul_neighborhood.district_id = istanbul_district.id
    join provinces ankara on ankara.provider_id = istanbul.provider_id
    join districts ankara_district on ankara_district.province_id = ankara.id
    join neighborhoods ankara_neighborhood on ankara_neighborhood.district_id = ankara_district.id
    where istanbul.provider_id = ${imported.providerId}::uuid
      and istanbul.name = 'İstanbul'
      and ankara.name = 'Ankara'
  `.execute(db)
  const row = locations.rows[0]
  if (!row) throw new Error('feed filter location fixture missing')

  return {
    brandIds: { renault: brands.get('renault')!, fiat: brands.get('fiat')! },
    seriesIds: { clio: series.get('clio')!, egea: series.get('egea')! },
    modelIds: { 'clio-model': models.get('clio-model')!, 'egea-model': models.get('egea-model')! },
    locations: {
      istanbul: {
        provinceId: row.istanbul_province,
        districtId: row.istanbul_district,
        neighborhoodId: row.istanbul_neighborhood,
      },
      ankara: {
        provinceId: row.ankara_province,
        districtId: row.ankara_district,
        neighborhoodId: row.ankara_neighborhood,
      },
    },
  }
}

async function insertFeedFixture(
  fixture: FeedFixture,
  references: Awaited<ReturnType<typeof createVehicleFixture>>,
) {
  const carSale = await db
    .selectFrom('listing_types')
    .select('id')
    .where('code', '=', 'car_sale')
    .executeTakeFirstOrThrow()
  const location = references.locations[fixture.location]

  const listing = await db.insertInto('listings')
    .values({
      id: fixture.id,
      owner_user_id: userId,
      listing_type_id: carSale.id,
      status: 'published',
      title: fixture.title,
      description: 'Filtre ve sıralama testi için hazırlanmış otomobil ilanı.',
      price_amount: fixture.priceAmount,
      currency: 'TRY',
      province_id: location.provinceId,
      district_id: location.districtId,
      neighborhood_id: location.neighborhoodId,
      contact_phone_e164: '+905551234567',
      show_phone: true,
      published_at: fixture.publishedAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  listingIds.push(listing.id)

  await db.insertInto('car_details').values({
    listing_id: listing.id,
    vehicle_model_id: references.modelIds[fixture.model],
    model_year: fixture.modelYear,
    mileage_km: fixture.mileageKm,
    fuel_type: fixture.fuelType,
    transmission: fixture.transmission,
    body_type: fixture.bodyType,
    vehicle_condition: fixture.vehicleCondition,
    engine_power_hp: 110,
    engine_displacement_cc: 999,
    drivetrain: fixture.drivetrain,
    color: fixture.color,
    under_warranty: false,
    heavy_damage_recorded: false,
    plate_nationality: 'tr',
    swap_available: fixture.swapAvailable,
    paint_status: 'original',
    replacement_status: 'none',
  }).execute()
}

async function referenceFixtureIds() {
  const result = await sql<{
    renault_brand: string
    fiat_brand: string
    clio_series: string
    egea_series: string
    clio_model: string
    egea_model: string
  }>`
    select
      renault.id::text as renault_brand,
      fiat.id::text as fiat_brand,
      clio.id::text as clio_series,
      egea.id::text as egea_series,
      clio_model.id::text as clio_model,
      egea_model.id::text as egea_model
    from vehicle_brands renault
    join vehicle_series clio on clio.brand_id = renault.id
    join vehicle_models clio_model on clio_model.series_id = clio.id
    join vehicle_brands fiat on fiat.id != renault.id
    join vehicle_series egea on egea.brand_id = fiat.id
    join vehicle_models egea_model on egea_model.series_id = egea.id
    where renault.id = ${brandIds[0]}::uuid
      and fiat.id = ${brandIds[1]}::uuid
  `.execute(db)
  const row = result.rows[0]
  if (!row) throw new Error('feed filter reference fixture missing')
  return row
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
  await sql`
    insert into auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${userId}::uuid, 'Feed Filter User', ${`feed-filter-${userId}@example.com`}, false, now(), now())
  `.execute(db)
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
  await sql`delete from auth."user" where id = ${userId}::uuid`.execute(db)
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('public car feed filters and sorting', () => {
  it('filters, sorts, and paginates with sort-aware cursors', async () => {
    const references = await createVehicleFixture()
    const ids = await referenceFixtureIds()
    const now = Date.now()
    const fixtures: FeedFixture[] = [
      {
        id: '0199f000-0000-7000-8000-000000001001',
        title: '2024 Renault Clio otomatik',
        brand: 'renault', series: 'clio', model: 'clio-model',
        priceAmount: '1250000', modelYear: 2024, mileageKm: 42000,
        fuelType: 'benzin', transmission: 'otomatik', bodyType: 'hatchback',
        drivetrain: 'front', vehicleCondition: 'second_hand', color: 'Beyaz',
        swapAvailable: true, location: 'istanbul',
        publishedAt: new Date(now - 20 * 86_400_000),
      },
      {
        id: '0199f000-0000-7000-8000-000000001002',
        title: '2022 Renault Clio dizel',
        brand: 'renault', series: 'clio', model: 'clio-model',
        priceAmount: '900000', modelYear: 2022, mileageKm: 78000,
        fuelType: 'dizel', transmission: 'manuel', bodyType: 'hatchback',
        drivetrain: 'front', vehicleCondition: 'second_hand', color: 'Kırmızı',
        swapAvailable: false, location: 'istanbul',
        publishedAt: new Date(now - 10 * 86_400_000),
      },
      {
        id: '0199f000-0000-7000-8000-000000001003',
        title: '2023 Fiat Egea sedan',
        brand: 'fiat', series: 'egea', model: 'egea-model',
        priceAmount: '1100000', modelYear: 2023, mileageKm: 55000,
        fuelType: 'benzin', transmission: 'manuel', bodyType: 'sedan',
        drivetrain: 'front', vehicleCondition: 'second_hand', color: 'Beyaz',
        swapAvailable: false, location: 'ankara',
        publishedAt: new Date(now - 1 * 86_400_000),
      },
      {
        id: '0199f000-0000-7000-8000-000000001004',
        title: '2021 Fiat Egea lpg',
        brand: 'fiat', series: 'egea', model: 'egea-model',
        priceAmount: '750000', modelYear: 2021, mileageKm: 120000,
        fuelType: 'lpg', transmission: 'manuel', bodyType: 'sedan',
        drivetrain: 'front', vehicleCondition: 'second_hand', color: 'Gri',
        swapAvailable: true, location: 'ankara',
        publishedAt: new Date(now - 5 * 86_400_000),
      },
    ]
    for (const fixture of fixtures) await insertFeedFixture(fixture, references)

    async function feed(values: Record<string, string | number | boolean | undefined>) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/listings/public/car-sale?${queryString(values)}`,
        headers: { host: 'localhost:3000' },
      })
      expect(response.statusCode).toBe(200)
      return response
    }

    async function idsFor(values: Record<string, string | number | boolean | undefined>) {
      const response = await feed(values)
      return (response.json().items as Array<{ id: string }>).map((item) => item.id)
    }

    expect(await idsFor({ sort: 'newest' })).toEqual([
      fixtures[2]!.id, fixtures[3]!.id, fixtures[1]!.id, fixtures[0]!.id,
    ])
    expect(await idsFor({ sort: 'oldest' })).toEqual([
      fixtures[0]!.id, fixtures[1]!.id, fixtures[3]!.id, fixtures[2]!.id,
    ])
    expect(await idsFor({ sort: 'price_asc' })).toEqual([
      fixtures[3]!.id, fixtures[1]!.id, fixtures[2]!.id, fixtures[0]!.id,
    ])
    expect(await idsFor({ sort: 'price_desc' })).toEqual([
      fixtures[0]!.id, fixtures[2]!.id, fixtures[1]!.id, fixtures[3]!.id,
    ])
    expect(await idsFor({ sort: 'mileage_asc' })).toEqual([
      fixtures[0]!.id, fixtures[2]!.id, fixtures[1]!.id, fixtures[3]!.id,
    ])
    expect(await idsFor({ sort: 'mileage_desc' })).toEqual([
      fixtures[3]!.id, fixtures[1]!.id, fixtures[2]!.id, fixtures[0]!.id,
    ])
    expect(await idsFor({ sort: 'year_desc' })).toEqual([
      fixtures[0]!.id, fixtures[2]!.id, fixtures[1]!.id, fixtures[3]!.id,
    ])
    expect(await idsFor({ sort: 'year_asc' })).toEqual([
      fixtures[3]!.id, fixtures[1]!.id, fixtures[2]!.id, fixtures[0]!.id,
    ])

    expect(await idsFor({ brandId: ids.renault_brand })).toEqual([fixtures[1]!.id, fixtures[0]!.id])
    expect(await idsFor({ seriesId: ids.clio_series })).toEqual([fixtures[1]!.id, fixtures[0]!.id])
    expect(await idsFor({ modelId: ids.egea_model })).toEqual([fixtures[2]!.id, fixtures[3]!.id])
    expect(await idsFor({ provinceId: references.locations.istanbul.provinceId })).toEqual([
      fixtures[1]!.id, fixtures[0]!.id,
    ])
    expect(await idsFor({ districtId: references.locations.ankara.districtId })).toEqual([
      fixtures[2]!.id, fixtures[3]!.id,
    ])
    expect(await idsFor({ minPrice: 1_000_000 })).toEqual([fixtures[2]!.id, fixtures[0]!.id])
    expect(await idsFor({ maxPrice: 1_000_000 })).toEqual([fixtures[3]!.id, fixtures[1]!.id])
    expect(await idsFor({ minYear: 2023 })).toEqual([fixtures[2]!.id, fixtures[0]!.id])
    expect(await idsFor({ maxMileageKm: 60_000 })).toEqual([fixtures[2]!.id, fixtures[0]!.id])
    expect(await idsFor({ minMileageKm: 80_000 })).toEqual([fixtures[3]!.id])
    expect(await idsFor({ fuelType: 'benzin' })).toEqual([fixtures[2]!.id, fixtures[0]!.id])
    expect(await idsFor({ transmission: 'otomatik' })).toEqual([fixtures[0]!.id])
    expect(await idsFor({ bodyType: 'sedan' })).toEqual([fixtures[2]!.id, fixtures[3]!.id])
    expect(await idsFor({ drivetrain: 'rear' })).toEqual([])
    expect(await idsFor({ vehicleCondition: 'second_hand' })).toHaveLength(4)
    expect(await idsFor({ color: 'Beyaz' })).toEqual([fixtures[2]!.id, fixtures[0]!.id])
    expect(await idsFor({ swapAvailable: true })).toEqual([fixtures[3]!.id, fixtures[0]!.id])
    expect(await idsFor({ q: 'Egea' })).toEqual([fixtures[2]!.id, fixtures[3]!.id])
    expect(await idsFor({ listedWithinDays: 7 })).toEqual([fixtures[2]!.id, fixtures[3]!.id])
    expect(await idsFor({ minPrice: 900_000, maxPrice: 1_100_000 })).toEqual([
      fixtures[2]!.id, fixtures[1]!.id,
    ])

    const firstPage = await feed({ sort: 'price_asc', limit: 2 })
    expect((firstPage.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([
      fixtures[3]!.id, fixtures[1]!.id,
    ])
    const cursor = firstPage.json().nextCursor as string
    expect(typeof cursor).toBe('string')

    const secondPage = await feed({ sort: 'price_asc', limit: 2, cursor })
    expect((secondPage.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([
      fixtures[2]!.id, fixtures[0]!.id,
    ])
    expect(secondPage.json().nextCursor).toBeNull()

    const cursorMismatch = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale?${queryString({ sort: 'price_desc', cursor })}`,
      headers: { host: 'localhost:3000' },
    })
    expect(cursorMismatch.statusCode).toBe(400)
    expect(cursorMismatch.json().error.code).toBe('VALIDATION_ERROR')

    const filterMismatch = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale?${queryString({
        sort: 'price_asc',
        cursor,
        brandId: ids.renault_brand,
      })}`,
      headers: { host: 'localhost:3000' },
    })
    expect(filterMismatch.statusCode).toBe(400)
    expect(filterMismatch.json().error.code).toBe('VALIDATION_ERROR')

    const invalidRange = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale?${queryString({ minPrice: 2_000_000, maxPrice: 1_000_000 })}`,
      headers: { host: 'localhost:3000' },
    })
    expect(invalidRange.statusCode).toBe(400)
    expect(invalidRange.json().error.code).toBe('VALIDATION_ERROR')

    const invalidSort = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/car-sale?sort=not-a-sort',
      headers: { host: 'localhost:3000' },
    })
    expect(invalidSort.statusCode).toBe(400)
  })
})
