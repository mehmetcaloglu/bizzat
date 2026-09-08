import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { buildApp } from '../src/app.js'
import { checkDatabase } from '../src/db/check.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { CanonicalVehicleCatalog } from '../src/reference/vehicle/catalog.types.js'
import { importVehicleCatalog } from '../src/reference/vehicle/catalog-importer.js'
import { validateVehicleCatalog } from '../src/reference/vehicle/catalog-validator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const catalogPath = fileURLToPath(new URL('../../../data/reference/vehicles/catalog.json', import.meta.url))

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)
let catalog: CanonicalVehicleCatalog

beforeAll(async () => {
  const parsed: unknown = JSON.parse(await readFile(catalogPath, 'utf8'))
  validateVehicleCatalog(parsed)
  catalog = parsed

  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  await db.deleteFrom('vehicle_source_mappings').execute()
  await db.deleteFrom('vehicle_models').execute()
  await db.deleteFrom('vehicle_series').execute()
  await db.deleteFrom('vehicle_brands').execute()
  await importVehicleCatalog(db, catalog)
  app = buildApp({ logger: false, readinessCheck: () => checkDatabase(db), db })
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('populated Turkish automobile catalog', () => {
  it('is materially larger than the Phase A fixture and has unique valid hierarchy keys', () => {
    expect(catalog.brands.length).toBeGreaterThan(3)
    expect(catalog.series.length).toBeGreaterThan(3)
    expect(catalog.models.length).toBeGreaterThan(4)
    expect(new Set(catalog.brands.map((item) => item.key)).size).toBe(catalog.brands.length)
    expect(new Set(catalog.series.map((item) => item.key)).size).toBe(catalog.series.length)
    expect(new Set(catalog.models.map((item) => item.key)).size).toBe(catalog.models.length)
  })

  it('serves populated canonical data without source metadata', async () => {
    const brands = await app.inject({ method: 'GET', url: '/api/v1/reference/vehicle/brands' })
    expect(brands.statusCode).toBe(200)
    const brandItems = brands.json<{ items: Array<{ id: string; name: string }> }>().items
    expect(brandItems.length).toBe(catalog.brands.length)
    expect(JSON.stringify(brandItems)).not.toMatch(/sourceKey|provider|availableModelYears|price|kasko/i)

    const renault = brandItems.find((item) => item.name === 'Renault')
    expect(renault).toBeDefined()
    const series = await app.inject({ method: 'GET', url: `/api/v1/reference/vehicle/brands/${renault!.id}/series` })
    expect(series.statusCode).toBe(200)
    const seriesItems = series.json<{ items: Array<{ id: string; name: string }> }>().items
    const clio = seriesItems.find((item) => item.name === 'Clio')
    expect(clio).toBeDefined()

    const models = await app.inject({ method: 'GET', url: `/api/v1/reference/vehicle/series/${clio!.id}/models` })
    expect(models.statusCode).toBe(200)
    expect(models.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0)
  })
})
