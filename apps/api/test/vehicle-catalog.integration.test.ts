import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { CanonicalVehicleCatalog } from '../src/reference/vehicle/catalog.types.js'
import { importVehicleCatalog } from '../src/reference/vehicle/catalog-importer.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
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
})

afterAll(async () => {
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
