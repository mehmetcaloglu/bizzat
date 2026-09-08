import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

function makeSnapshot(code = `location-${Date.now()}`): NormalizedLocationSnapshot {
  return {
    provider: { code, sourceName: 'Location integration fixture', version: '1' },
    provinces: [
      { sourceKey: '34', code: '34', name: 'İstanbul' },
      { sourceKey: '06', code: '06', name: 'Ankara' },
    ],
    districts: [
      { sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' },
      { sourceKey: '34-sariyer', provinceSourceKey: '34', name: 'Sarıyer' },
      { sourceKey: '06-cankaya', provinceSourceKey: '06', name: 'Çankaya' },
    ],
    neighborhoods: [
      { sourceKey: '34-gungoren-haznedar', districtSourceKey: '34-gungoren', name: 'Haznedar', kind: 'mahalle' },
      { sourceKey: '34-gungoren-mc', districtSourceKey: '34-gungoren', name: 'Mareşal Çakmak', kind: 'mahalle' },
      { sourceKey: '34-sariyer-maslak', districtSourceKey: '34-sariyer', name: 'Maslak', kind: 'mahalle' },
      { sourceKey: '06-cankaya-balgat', districtSourceKey: '06-cankaya', name: 'Balgat', kind: 'mahalle' },
    ],
  }
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  app = buildApp({ logger: false, readinessCheck: () => checkDatabase(db), db })
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('location reference schema', () => {
  it('creates reference tables and enforces foreign keys', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('reference_data_providers','reference_data_imports','provinces','districts','neighborhoods')
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'districts', 'neighborhoods', 'provinces', 'reference_data_imports', 'reference_data_providers',
    ])
  })
})

describe('location importer', () => {
  it('is idempotent and keeps stable ids across rename/deactivate/reactivate', async () => {
    const value = makeSnapshot()
    const first = await importLocationSnapshot(db, value)
    const second = await importLocationSnapshot(db, value)
    expect(second.providerId).toBe(first.providerId)
    expect(second.importId).toBe(first.importId)

    const before = await db.selectFrom('districts')
      .select(['id', 'name'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '34-gungoren')
      .executeTakeFirstOrThrow()

    value.provider.version = '2'
    value.districts[0]!.name = 'Güngören Updated'
    value.neighborhoods = value.neighborhoods.filter((item) => item.sourceKey !== '34-gungoren-haznedar')
    await importLocationSnapshot(db, value)

    const afterRename = await db.selectFrom('districts')
      .select(['id', 'name'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '34-gungoren')
      .executeTakeFirstOrThrow()
    expect(afterRename).toEqual({ id: before.id, name: 'Güngören Updated' })

    const inactive = await db.selectFrom('neighborhoods')
      .select(['id', 'active'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '34-gungoren-haznedar')
      .executeTakeFirstOrThrow()
    expect(inactive.active).toBe(false)

    value.provider.version = '3'
    value.neighborhoods.push({ sourceKey: '34-gungoren-haznedar', districtSourceKey: '34-gungoren', name: 'Haznedar', kind: 'mahalle' })
    await importLocationSnapshot(db, value)

    const reactivated = await db.selectFrom('neighborhoods')
      .select(['id', 'active'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '34-gungoren-haznedar')
      .executeTakeFirstOrThrow()
    expect(reactivated).toEqual({ id: inactive.id, active: true })
  })

  it('rejects invalid snapshots before changing working data', async () => {
    const value = makeSnapshot(`rollback-${Date.now()}`)
    const imported = await importLocationSnapshot(db, value)
    const before = await db.selectFrom('provinces')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('provider_id', '=', imported.providerId)
      .executeTakeFirstOrThrow()

    value.districts[0]!.provinceSourceKey = 'missing'
    await expect(importLocationSnapshot(db, value)).rejects.toMatchObject({ code: 'LOCATION_SNAPSHOT_INVALID' })

    const after = await db.selectFrom('provinces')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('provider_id', '=', imported.providerId)
      .executeTakeFirstOrThrow()
    expect(Number(after.count)).toBe(Number(before.count))
  })
})

describe('location reference API', () => {
  it('returns active hierarchy only and 404s unknown parents', async () => {
    const value = makeSnapshot(`api-${Date.now()}`)
    const imported = await importLocationSnapshot(db, value)

    const provinces = await app.inject({ method: 'GET', url: '/api/v1/reference/provinces' })
    expect(provinces.statusCode).toBe(200)
    const provinceItems = provinces.json().items
    expect(provinceItems.map((item: { code: string }) => item.code)).toEqual(['06', '34'])
    expect(provinceItems[0]).not.toHaveProperty('provider_id')
    expect(provinceItems[0]).not.toHaveProperty('source_key')

    const istanbul = await db.selectFrom('provinces')
      .select('id')
      .where('provider_id', '=', imported.providerId)
      .where('code', '=', '34')
      .executeTakeFirstOrThrow()

    const districts = await app.inject({ method: 'GET', url: `/api/v1/reference/provinces/${istanbul.id}/districts` })
    expect(districts.statusCode).toBe(200)
    expect(districts.json().items.map((item: { name: string }) => item.name)).toEqual(['Güngören', 'Sarıyer'])

    const gungoren = await db.selectFrom('districts')
      .select('id')
      .where('provider_id', '=', imported.providerId)
      .where('source_key', '=', '34-gungoren')
      .executeTakeFirstOrThrow()

    const neighborhoods = await app.inject({ method: 'GET', url: `/api/v1/reference/districts/${gungoren.id}/neighborhoods` })
    expect(neighborhoods.statusCode).toBe(200)
    expect(neighborhoods.json().items.map((item: { name: string }) => item.name)).toEqual(['Haznedar', 'Mareşal Çakmak'])

    const unknown = await app.inject({ method: 'GET', url: '/api/v1/reference/provinces/00000000-0000-0000-0000-000000000000/districts' })
    expect(unknown.statusCode).toBe(404)
    expect(unknown.json().error.code).toBe('REFERENCE_PARENT_NOT_FOUND')
  })
})
