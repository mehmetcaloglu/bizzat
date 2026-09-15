import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { CanonicalVehicleCatalog } from '../src/reference/vehicle/catalog.types.js'
import { importVehicleCatalog } from '../src/reference/vehicle/catalog-importer.js'
import { VehicleCatalogRepository } from '../src/reference/vehicle/vehicle-catalog.repository.js'
import { VehicleCatalogService } from '../src/reference/vehicle/vehicle-catalog.service.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

function makeCatalog(): CanonicalVehicleCatalog {
  return {
    version: 'listing-lookup-fixture',
    brands: [{ key: 'renault', name: 'Renault' }],
    series: [{ key: 'renault:clio', brandKey: 'renault', name: 'Clio' }],
    models: [
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
        key: 'renault:clio:legacy-leaf',
        seriesKey: 'renault:clio',
        name: 'Legacy Leaf',
      },
    ],
  }
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
})

beforeEach(async () => {
  await db.deleteFrom('car_details').execute()
  await db.deleteFrom('listings').execute()
  await db.deleteFrom('vehicle_source_mappings').execute()
  await db.deleteFrom('vehicle_models').execute()
  await db.deleteFrom('vehicle_series').execute()
  await db.deleteFrom('vehicle_brands').execute()
})

afterAll(async () => {
  await db.destroy()
  await authPool.end()
})

describe('canonical vehicle lookup for listing drafts', () => {
  it('returns active canonical brand, series and variable-depth selection path', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const model = await db
      .selectFrom('vehicle_models')
      .select('id')
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()

    const service = new VehicleCatalogService(new VehicleCatalogRepository(db))
    const summary = await service.findActiveModelSummary(model.id)

    expect(summary).toEqual({
      modelId: model.id,
      brand: { id: expect.any(String), name: 'Renault' },
      series: { id: expect.any(String), name: 'Clio' },
      selectionPath: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
        { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution' },
      ],
    })
  })

  it('uses a single leaf path for legacy models without selection_path', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const model = await db
      .selectFrom('vehicle_models')
      .select('id')
      .where('catalog_key', '=', 'renault:clio:legacy-leaf')
      .executeTakeFirstOrThrow()

    const service = new VehicleCatalogService(new VehicleCatalogRepository(db))
    const summary = await service.findActiveModelSummary(model.id)

    expect(summary?.selectionPath).toEqual([
      { key: 'renault:clio:legacy-leaf', name: 'Legacy Leaf' },
    ])
  })

  it('returns null for unknown or inactive canonical models', async () => {
    await importVehicleCatalog(db, makeCatalog())
    const model = await db
      .selectFrom('vehicle_models')
      .select('id')
      .where('catalog_key', '=', 'renault:clio:1-0-tce-evolution')
      .executeTakeFirstOrThrow()

    await db.updateTable('vehicle_models').set({ active: false }).where('id', '=', model.id).execute()

    const service = new VehicleCatalogService(new VehicleCatalogRepository(db))

    await expect(service.findActiveModelSummary(model.id)).resolves.toBeNull()
    await expect(service.findActiveModelSummary(crypto.randomUUID())).resolves.toBeNull()
  })
})
