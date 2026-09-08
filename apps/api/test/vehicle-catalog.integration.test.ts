import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { buildApp } from '../src/app.js'
import { checkDatabase } from '../src/db/check.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { CanonicalVehicleCatalog } from '../src/reference/vehicle/catalog.types.js'
import { importVehicleCatalog } from '../src/reference/vehicle/catalog-importer.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

function makeCatalog(): CanonicalVehicleCatalog {
  return {
    version: 'fixture-1',
    brands: [
      { key: 'fiat', name: 'Fiat' },
      { key: 'renault', name: 'Renault' },
    ],
    series: [
      { key: 'fiat:egea', brandKey: 'fiat', name: 'Egea' },
      { key: 'renault:clio', brandKey: 'renault', name: 'Clio' },
    ],
    models: [
      { key: 'fiat:egea:1-4-fire-easy', seriesKey: 'fiat:egea', name: '1.4 Fire Easy' },
      { key: 'renault:clio:1-0-tce-evolution', seriesKey: 'renault:clio', name: '1.0 TCe Evolution' },
      { key: 'renault:clio:1-0-tce-joy', seriesKey: 'renault:clio', name: '1.0 TCe Joy' },
    ],
  }
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  app = buildApp({
    logger: false,
    readinessCheck: () => checkDatabase(db),
    db,
  })
})

beforeEach(async () => {
  await db.deleteFrom('vehicle_models').execute()
  await db.deleteFrom('vehicle_series').execute()
  await db.deleteFrom('vehicle_brands').execute()
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('vehicle catalog schema', () => {
  it('creates canonical vehicle tables and enforces parent foreign keys', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('vehicle_brands', 'vehicle_series', 'vehicle_models')
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'vehicle_brands',
      'vehicle_models',
      'vehicle_series',
    ])

    await expect(db.insertInto('vehicle_series').values({
      brand_id: '00000000-0000-0000-0000-000000000000',
      catalog_key: 'orphan:series',
      name: 'Orphan',
    }).execute()).rejects.toThrow()
  })
})

describe('vehicle catalog importer', () => {
  it('is idempotent and preserves ids across rename, deactivate and reactivate', async () => {
    const catalog = makeCatalog()
    const first = await importVehicleCatalog(db, catalog)
    expect(first.counts).toEqual({ brands: 2, series: 2, models: 3 })

    const joyBefore = await db.selectFrom('vehicle_models')
      .select(['id', 'name', 'active'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-joy')
      .executeTakeFirstOrThrow()
    const evolutionBefore = await db.selectFrom('vehicle_models')
      .select(['id', 'name'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()

    await importVehicleCatalog(db, catalog)
    const counts = await Promise.all([
      db.selectFrom('vehicle_brands').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('vehicle_series').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('vehicle_models').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
    ])
    expect(counts.map((row) => Number(row.count))).toEqual([2, 2, 3])

    catalog.version = 'fixture-2'
    catalog.models.find((item) => item.key === 'renault:clio:1-0-tce-evolution')!.name = '1.0 TCe Evolution Updated'
    catalog.models = catalog.models.filter((item) => item.key !== 'renault:clio:1-0-tce-joy')
    await importVehicleCatalog(db, catalog)

    const evolutionAfter = await db.selectFrom('vehicle_models')
      .select(['id', 'name'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()
    expect(evolutionAfter).toEqual({
      id: evolutionBefore.id,
      name: '1.0 TCe Evolution Updated',
    })

    const joyInactive = await db.selectFrom('vehicle_models')
      .select(['id', 'active'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-joy')
      .executeTakeFirstOrThrow()
    expect(joyInactive).toEqual({ id: joyBefore.id, active: false })

    catalog.version = 'fixture-3'
    catalog.models.push({
      key: 'renault:clio:1-0-tce-joy',
      seriesKey: 'renault:clio',
      name: '1.0 TCe Joy',
    })
    await importVehicleCatalog(db, catalog)

    const joyReactivated = await db.selectFrom('vehicle_models')
      .select(['id', 'active'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-joy')
      .executeTakeFirstOrThrow()
    expect(joyReactivated).toEqual({ id: joyBefore.id, active: true })
  })

  it('rejects invalid catalogs before changing working data', async () => {
    const catalog = makeCatalog()
    await importVehicleCatalog(db, catalog)

    const before = await db.selectFrom('vehicle_models')
      .select(['catalog_key', 'name', 'active'])
      .orderBy('catalog_key')
      .execute()

    catalog.series[0]!.brandKey = 'missing-brand'
    await expect(importVehicleCatalog(db, catalog)).rejects.toMatchObject({
      code: 'VEHICLE_CATALOG_INVALID',
    })

    const after = await db.selectFrom('vehicle_models')
      .select(['catalog_key', 'name', 'active'])
      .orderBy('catalog_key')
      .execute()
    expect(after).toEqual(before)
  })
})

describe('vehicle catalog reference API', () => {
  it('returns active hierarchy without exposing catalog keys', async () => {
    await importVehicleCatalog(db, makeCatalog())

    const brands = await app.inject({ method: 'GET', url: '/api/v1/reference/vehicle/brands' })
    expect(brands.statusCode).toBe(200)
    expect(brands.json().items.map((item: { name: string }) => item.name)).toEqual(['Fiat', 'Renault'])
    expect(brands.json().items[0]).not.toHaveProperty('catalog_key')

    const renault = await db.selectFrom('vehicle_brands')
      .select('id')
      .where('catalog_key', '=', 'renault')
      .executeTakeFirstOrThrow()
    const clio = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'renault:clio')
      .executeTakeFirstOrThrow()

    const series = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/brands/${renault.id}/series`,
    })
    expect(series.statusCode).toBe(200)
    expect(series.json().items.map((item: { name: string }) => item.name)).toEqual(['Clio'])
    expect(series.json().items[0]).not.toHaveProperty('catalog_key')

    const models = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/models`,
    })
    expect(models.statusCode).toBe(200)
    expect(models.json().items.map((item: { name: string }) => item.name)).toEqual([
      '1.0 TCe Evolution',
      '1.0 TCe Joy',
    ])
    expect(models.json().items[0]).not.toHaveProperty('catalog_key')
  })

  it('returns the common 404 for unknown or inactive parents', async () => {
    await importVehicleCatalog(db, makeCatalog())

    const renault = await db.selectFrom('vehicle_brands')
      .select('id')
      .where('catalog_key', '=', 'renault')
      .executeTakeFirstOrThrow()
    const clio = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'renault:clio')
      .executeTakeFirstOrThrow()

    const unknownBrand = await app.inject({
      method: 'GET',
      url: '/api/v1/reference/vehicle/brands/00000000-0000-0000-0000-000000000000/series',
    })
    expect(unknownBrand.statusCode).toBe(404)
    expect(unknownBrand.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')

    const unknownSeries = await app.inject({
      method: 'GET',
      url: '/api/v1/reference/vehicle/series/00000000-0000-0000-0000-000000000000/models',
    })
    expect(unknownSeries.statusCode).toBe(404)
    expect(unknownSeries.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')

    await db.updateTable('vehicle_brands').set({ active: false }).where('id', '=', renault.id).execute()
    const inactiveBrand = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/brands/${renault.id}/series`,
    })
    expect(inactiveBrand.statusCode).toBe(404)
    expect(inactiveBrand.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')

    await db.updateTable('vehicle_series').set({ active: false }).where('id', '=', clio.id).execute()
    const inactiveSeries = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/models`,
    })
    expect(inactiveSeries.statusCode).toBe(404)
    expect(inactiveSeries.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')
  })
})
