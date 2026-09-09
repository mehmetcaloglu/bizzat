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
      {
        key: 'renault:clio:1-0-tce-evolution',
        seriesKey: 'renault:clio',
        name: '1.0 TCe Evolution',
        selectionPath: [
          { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
          { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution' },
        ],
      },
      {
        key: 'renault:clio:1-0-tce-joy',
        seriesKey: 'renault:clio',
        name: '1.0 TCe Joy',
        selectionPath: [
          { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
          { key: 'renault:clio:1-0-tce-joy', name: 'Joy' },
        ],
      },
      {
        key: 'renault:clio:sport-tourer:0-9-tce-touch',
        seriesKey: 'renault:clio',
        name: '0.9 TCe Sport Tourer Touch',
        selectionPath: [
          { key: 'renault:clio:sport-tourer', name: 'Sport Tourer' },
          { key: 'renault:clio:sport-tourer:0-9-tce', name: '0.9 TCe' },
          { key: 'renault:clio:sport-tourer:0-9-tce-touch', name: 'Touch' },
        ],
      },
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
  await db.deleteFrom('vehicle_source_mappings').execute()
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

  it('rejects empty and non-array selection paths at the database boundary', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const clio = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'renault:clio')
      .executeTakeFirstOrThrow()

    await expect(db.insertInto('vehicle_models').values({
      series_id: clio.id,
      catalog_key: 'renault:clio:invalid-empty',
      name: 'Invalid empty',
      selection_path: '[]',
    }).execute()).rejects.toThrow()

    await expect(sql`
      insert into vehicle_models (series_id, catalog_key, name, selection_path)
      values (${clio.id}, 'renault:clio:invalid-object', 'Invalid object', '{}'::jsonb)
    `.execute(db)).rejects.toThrow()
  })
})

describe('vehicle catalog importer', () => {
  it('is idempotent and preserves ids across rename, deactivate and reactivate', async () => {
    const catalog = makeCatalog()
    const first = await importVehicleCatalog(db, catalog)
    expect(first.counts).toEqual({ brands: 2, series: 2, models: 4 })

    const joyBefore = await db.selectFrom('vehicle_models')
      .select(['id', 'name', 'active'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-joy')
      .executeTakeFirstOrThrow()
    const evolutionBefore = await db.selectFrom('vehicle_models')
      .select(['id', 'name', 'selection_path'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()

    await importVehicleCatalog(db, catalog)
    const counts = await Promise.all([
      db.selectFrom('vehicle_brands').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('vehicle_series').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
      db.selectFrom('vehicle_models').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow(),
    ])
    expect(counts.map((row) => Number(row.count))).toEqual([2, 2, 4])

    catalog.version = 'fixture-2'
    catalog.models.find((item) => item.key === 'renault:clio:1-0-tce-evolution')!.name = '1.0 TCe Evolution Updated'
    Object.assign(
      catalog.models.find((item) => item.key === 'renault:clio:1-0-tce-evolution')!,
      {
        selectionPath: [
          { key: 'renault:clio:updated-engine', name: 'Updated engine' },
          { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution Updated' },
        ],
      },
    )
    catalog.models = catalog.models.filter((item) => item.key !== 'renault:clio:1-0-tce-joy')
    await importVehicleCatalog(db, catalog)

    const evolutionAfter = await db.selectFrom('vehicle_models')
      .select(['id', 'name', 'selection_path'])
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()
    expect(evolutionAfter).toEqual({
      id: evolutionBefore.id,
      name: '1.0 TCe Evolution Updated',
      selection_path: [
        { key: 'renault:clio:updated-engine', name: 'Updated engine' },
        { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution Updated' },
      ],
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
      selectionPath: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
        { key: 'renault:clio:1-0-tce-joy', name: 'Joy' },
      ],
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

    const malformedPathCatalog: unknown = {
      ...makeCatalog(),
      models: makeCatalog().models.map((model, index) => index === 0
        ? { ...model, selectionPath: [] }
        : model),
    }
    await expect(importVehicleCatalog(db, malformedPathCatalog)).rejects.toMatchObject({
      code: 'VEHICLE_CATALOG_INVALID',
    })

    const afterMalformedPath = await db.selectFrom('vehicle_models')
      .select(['catalog_key', 'name', 'active'])
      .orderBy('catalog_key')
      .execute()
    expect(afterMalformedPath).toEqual(before)
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
      '0.9 TCe Sport Tourer Touch',
      '1.0 TCe Evolution',
      '1.0 TCe Joy',
    ])
    expect(models.json().items[0]).not.toHaveProperty('catalog_key')
  })

  it('walks variable-depth selection paths and falls back to a legacy model leaf', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const clio = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'renault:clio')
      .executeTakeFirstOrThrow()
    const egea = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'fiat:egea')
      .executeTakeFirstOrThrow()
    const models = await db.selectFrom('vehicle_models')
      .select(['id', 'catalog_key'])
      .execute()
    const modelIds = new Map(models.map((model) => [model.catalog_key, model.id]))

    const roots = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection`,
    })
    expect(roots.statusCode).toBe(200)
    expect(roots.json()).toEqual({
      items: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe', kind: 'group' },
        { key: 'renault:clio:sport-tourer', name: 'Sport Tourer', kind: 'group' },
      ],
    })

    const engineChildren = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection?parentKey=renault%3Aclio%3A1-0-tce`,
    })
    expect(engineChildren.statusCode).toBe(200)
    expect(engineChildren.json()).toEqual({
      items: [
        {
          key: 'renault:clio:1-0-tce-evolution',
          name: 'Evolution',
          kind: 'model',
          id: modelIds.get('renault:clio:1-0-tce-evolution'),
        },
        {
          key: 'renault:clio:1-0-tce-joy',
          name: 'Joy',
          kind: 'model',
          id: modelIds.get('renault:clio:1-0-tce-joy'),
        },
      ],
    })

    const bodyChildren = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection?parentKey=renault%3Aclio%3Asport-tourer`,
    })
    expect(bodyChildren.statusCode).toBe(200)
    expect(bodyChildren.json()).toEqual({
      items: [{
        key: 'renault:clio:sport-tourer:0-9-tce',
        name: '0.9 TCe',
        kind: 'group',
      }],
    })

    const nestedLeaf = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection?parentKey=renault%3Aclio%3Asport-tourer%3A0-9-tce`,
    })
    expect(nestedLeaf.statusCode).toBe(200)
    expect(nestedLeaf.json()).toEqual({
      items: [{
        key: 'renault:clio:sport-tourer:0-9-tce-touch',
        name: 'Touch',
        kind: 'model',
        id: modelIds.get('renault:clio:sport-tourer:0-9-tce-touch'),
      }],
    })

    const legacyLeaf = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${egea.id}/selection`,
    })
    expect(legacyLeaf.statusCode).toBe(200)
    expect(legacyLeaf.json()).toEqual({
      items: [{
        key: 'fiat:egea:1-4-fire-easy',
        name: '1.4 Fire Easy',
        kind: 'model',
        id: modelIds.get('fiat:egea:1-4-fire-easy'),
      }],
    })
  })

  it('filters inactive leaves and rejects unknown, scoped and terminal parents', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const clio = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'renault:clio')
      .executeTakeFirstOrThrow()
    const egea = await db.selectFrom('vehicle_series')
      .select('id')
      .where('catalog_key', '=', 'fiat:egea')
      .executeTakeFirstOrThrow()

    await db.updateTable('vehicle_models')
      .set({ active: false })
      .where('catalog_key', 'in', [
        'renault:clio:1-0-tce-evolution',
        'renault:clio:1-0-tce-joy',
      ])
      .execute()

    const activeRoots = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection`,
    })
    expect(activeRoots.statusCode).toBe(200)
    expect(activeRoots.json()).toEqual({
      items: [{ key: 'renault:clio:sport-tourer', name: 'Sport Tourer', kind: 'group' }],
    })

    for (const [seriesId, parentKey] of [
      [clio.id, 'missing-group'],
      [egea.id, 'renault:clio:1-0-tce'],
      [clio.id, 'renault:clio:1-0-tce'],
      [clio.id, 'renault:clio:sport-tourer:0-9-tce-touch'],
    ]) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/reference/vehicle/series/${seriesId}/selection?parentKey=${encodeURIComponent(parentKey)}`,
      })
      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')
    }
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

    const inactiveSeriesSelection = await app.inject({
      method: 'GET',
      url: `/api/v1/reference/vehicle/series/${clio.id}/selection`,
    })
    expect(inactiveSeriesSelection.statusCode).toBe(404)
    expect(inactiveSeriesSelection.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')
  })
})
