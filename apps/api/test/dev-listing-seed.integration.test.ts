import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import {
  DEVELOPMENT_CAR_LISTING_FIXTURES,
  seedDevelopmentCarListings,
  type DevelopmentCarListingFixture,
} from '../src/modules/listings/dev-listing-seed.js'
import type { NormalizedLocationSnapshot } from '../src/reference/import/location-import.types.js'
import { importLocationSnapshot } from '../src/reference/import/location-importer.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

const listingId = '0199f000-0000-7000-8000-000000000091'
const productionGuardListingId = '0199f000-0000-7000-8000-000000000092'
let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)
const userId = crypto.randomUUID()
let modelId: string

const fixture: DevelopmentCarListingFixture = {
  id: listingId,
  vehicleCatalogKey: 'seed-test:car:model',
  location: {
    providerCode: 'listing-seed-test',
    provinceSourceKey: '34',
    districtSourceKey: '34-test',
    neighborhoodSourceKey: '34-test-center',
  },
  modelYear: 2024,
  mileageKm: 21500,
  priceAmount: 1234000,
  description: 'Tamamen geliştirme testi için oluşturulmuş deterministik örnek otomobil ilanı.',
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)

  await sql`
    insert into auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${userId}::uuid, 'Seed Test User', ${`seed-${userId}@example.com`}, false, now(), now())
  `.execute(db)

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: 'seed-test', name: 'Seed Test', active: true })
    .onConflict((conflict) => conflict.column('catalog_key').doUpdateSet({ active: true }))
    .returning('id')
    .executeTakeFirstOrThrow()
  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: 'seed-test:car', name: 'Seed Car', active: true })
    .onConflict((conflict) => conflict.column('catalog_key').doUpdateSet({ active: true }))
    .returning('id')
    .executeTakeFirstOrThrow()
  const model = await db.insertInto('vehicle_models')
    .values({
      series_id: series.id,
      catalog_key: fixture.vehicleCatalogKey,
      name: 'Seed Model',
      active: true,
      selection_path: JSON.stringify([{ key: fixture.vehicleCatalogKey, name: 'Seed Model' }]),
    })
    .onConflict((conflict) => conflict.column('catalog_key').doUpdateSet({ active: true }))
    .returning('id')
    .executeTakeFirstOrThrow()
  modelId = model.id

  const snapshot: NormalizedLocationSnapshot = {
    provider: { code: fixture.location.providerCode, sourceName: 'Seed Test', version: '1' },
    provinces: [{ sourceKey: '34', code: '34', name: 'İstanbul' }],
    districts: [{ sourceKey: '34-test', provinceSourceKey: '34', name: 'Test İlçesi' }],
    neighborhoods: [{
      sourceKey: '34-test-center',
      districtSourceKey: '34-test',
      name: 'Test Mahallesi',
      kind: 'mahalle',
    }],
  }
  await importLocationSnapshot(db, snapshot)
})

afterAll(async () => {
  await db.deleteFrom('car_details').where('listing_id', 'in', [listingId, productionGuardListingId]).execute()
  await db.deleteFrom('listings').where('id', 'in', [listingId, productionGuardListingId]).execute()
  await sql`delete from auth."user" where id = ${userId}::uuid`.execute(db)
  await db.deleteFrom('vehicle_models').where('catalog_key', '=', fixture.vehicleCatalogKey).execute()
  await db.deleteFrom('vehicle_series').where('catalog_key', '=', 'seed-test:car').execute()
  await db.deleteFrom('vehicle_brands').where('catalog_key', '=', 'seed-test').execute()
  await db.destroy()
  await authPool.end()
})

describe('development car listing seed', () => {
  it('keeps every default fixture resolvable by the committed small development fixtures', async () => {
    const vehicleCatalog = JSON.parse(await readFile(
      new URL('../../../data/reference/vehicles/fixture.catalog.json', import.meta.url),
      'utf8',
    )) as { models: Array<{ key: string }> }
    const locationCatalog = JSON.parse(await readFile(
      new URL('../../../data/reference/locations/fixture.locations.json', import.meta.url),
      'utf8',
    )) as {
      provider: { code: string }
      provinces: Array<{ sourceKey: string }>
      districts: Array<{ sourceKey: string; provinceSourceKey: string }>
      neighborhoods: Array<{ sourceKey: string; districtSourceKey: string }>
    }

    const modelKeys = new Set(vehicleCatalog.models.map((model) => model.key))

    for (const defaultFixture of DEVELOPMENT_CAR_LISTING_FIXTURES) {
      expect(modelKeys.has(defaultFixture.vehicleCatalogKey)).toBe(true)
      expect(locationCatalog.provider.code).toBe(defaultFixture.location.providerCode)
      expect(locationCatalog.provinces.some(
        (province) => province.sourceKey === defaultFixture.location.provinceSourceKey,
      )).toBe(true)
      expect(locationCatalog.districts.some(
        (district) => district.sourceKey === defaultFixture.location.districtSourceKey
          && district.provinceSourceKey === defaultFixture.location.provinceSourceKey,
      )).toBe(true)
      expect(locationCatalog.neighborhoods.some(
        (neighborhood) => neighborhood.sourceKey === defaultFixture.location.neighborhoodSourceKey
          && neighborhood.districtSourceKey === defaultFixture.location.districtSourceKey,
      )).toBe(true)
    }
  })

  it('upserts deterministic published fixtures without creating duplicates', async () => {
    const first = await seedDevelopmentCarListings(db, userId, 'test', [fixture])
    const second = await seedDevelopmentCarListings(db, userId, 'test', [fixture])

    expect(first).toEqual({ upserted: 1, listingIds: [listingId] })
    expect(second).toEqual({ upserted: 1, listingIds: [listingId] })

    const rows = await db.selectFrom('listings')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .select([
        'listings.id',
        'listings.status',
        'listings.price_amount',
        'listings.currency',
        'car_details.vehicle_model_id',
        'car_details.model_year',
        'car_details.mileage_km',
      ])
      .where('listings.id', '=', listingId)
      .execute()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: listingId,
      status: 'published',
      price_amount: '1234000.00',
      currency: 'TRY',
      vehicle_model_id: modelId,
      model_year: 2024,
      mileage_km: 21500,
    })
  })

  it('refuses to run in production', async () => {
    const productionFixture = { ...fixture, id: productionGuardListingId }

    await expect(seedDevelopmentCarListings(db, userId, 'production', [productionFixture]))
      .rejects.toThrow('Development listing seed is disabled in production')

    const row = await db.selectFrom('listings')
      .select('id')
      .where('id', '=', productionGuardListingId)
      .executeTakeFirst()
    expect(row).toBeUndefined()
  })
})
