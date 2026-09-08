import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import { importVehicleSourceSnapshot } from '../src/reference/vehicle/source/source-importer.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'
import {
  VehicleSourceValidationError,
  validateAndNormalizeVehicleSourceSnapshot,
} from '../src/reference/vehicle/source/source-validator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const fixedNow = new Date('2026-09-08T00:00:00Z')

let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

function makeSnapshot(
  version = 'fixture-1',
  overrides: Partial<Record<string, { brandRaw?: string; typeRaw?: string; years?: number[] }>> = {},
): NormalizedVehicleSourceSnapshot {
  const rows = [
    {
      sourceKey: '144-1064',
      brandRaw: 'TOYOTA',
      typeRaw: 'COROLLA 1.33 LIFE',
      availableModelYears: [2016, 2017, 2018],
    },
    {
      sourceKey: '122-1260',
      brandRaw: 'RENAULT (OYAK)',
      typeRaw: 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90',
      availableModelYears: [2022, 2023, 2024],
    },
    {
      sourceKey: '100-0001',
      brandRaw: 'FIAT',
      typeRaw: 'EGEA SEDAN EASY 1.4 FIRE 95',
      availableModelYears: [2020, 2021],
    },
  ].map((row) => {
    const override = overrides[row.sourceKey]
    return {
      ...row,
      brandRaw: override?.brandRaw ?? row.brandRaw,
      typeRaw: override?.typeRaw ?? row.typeRaw,
      availableModelYears: override?.years ?? row.availableModelYears,
    }
  })

  return validateAndNormalizeVehicleSourceSnapshot({
    provider: {
      code: 'tsb-kasko',
      sourceName: 'TSB integration fixture',
      sourceUrl: 'https://www.tsb.org.tr/tr/kasko-arsiv-listesi',
      version,
    },
    records: rows,
  }, fixedNow)
}

async function seedCanonicalModel(): Promise<{ id: string; catalogKey: string }> {
  const suffix = randomUUID()
  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: `test-brand:${suffix}`, name: 'Test Brand' })
    .returning('id')
    .executeTakeFirstOrThrow()
  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: `test-series:${suffix}`, name: 'Test Series' })
    .returning('id')
    .executeTakeFirstOrThrow()
  const catalogKey = `test-model:${suffix}`
  const model = await db.insertInto('vehicle_models')
    .values({ series_id: series.id, catalog_key: catalogKey, name: 'Test Model' })
    .returning('id')
    .executeTakeFirstOrThrow()
  return { id: model.id, catalogKey }
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
})

beforeEach(async () => {
  await db.deleteFrom('vehicle_source_mappings').execute()
  await db.deleteFrom('vehicle_source_records').execute()
  await db.deleteFrom('vehicle_source_imports').execute()
  await db.deleteFrom('vehicle_source_providers').execute()
})

afterAll(async () => {
  await db.destroy()
  await authPool.end()
})

describe('vehicle source schema', () => {
  it('creates source provenance/mapping tables and enforces foreign keys', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'vehicle_source_providers',
          'vehicle_source_imports',
          'vehicle_source_records',
          'vehicle_source_mappings'
        )
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'vehicle_source_imports',
      'vehicle_source_mappings',
      'vehicle_source_providers',
      'vehicle_source_records',
    ])

    await expect(sql`
      insert into vehicle_source_imports (provider_id, version, checksum_sha256)
      values ('00000000-0000-0000-0000-000000000000', 'fk-test', 'abc')
    `.execute(db)).rejects.toThrow()
  })
})

describe('vehicle source importer', () => {
  it('is idempotent and preserves source identity through year updates, deactivate and reactivate', async () => {
    const firstSnapshot = makeSnapshot()
    const first = await importVehicleSourceSnapshot(db, firstSnapshot)
    expect(first.counts).toEqual({
      inserted: 3,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      reviewRequiredSet: 0,
    })

    const firstRows = await db.selectFrom('vehicle_source_records')
      .select(['id', 'source_key', 'available_model_years', 'active'])
      .where('provider_id', '=', first.providerId)
      .orderBy('source_key')
      .execute()

    const replay = await importVehicleSourceSnapshot(db, makeSnapshot())
    expect(replay.providerId).toBe(first.providerId)
    expect(replay.importId).toBe(first.importId)
    expect(replay.counts).toEqual({
      inserted: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      reviewRequiredSet: 0,
    })

    const yearUpdate = makeSnapshot('fixture-2', {
      '144-1064': { years: [2015, 2016, 2017, 2018] },
    })
    const updated = await importVehicleSourceSnapshot(db, yearUpdate)
    expect(updated.counts.updated).toBe(1)

    const toyotaBefore = firstRows.find((row) => row.source_key === '144-1064')!
    const toyotaAfter = await db.selectFrom('vehicle_source_records')
      .select(['id', 'available_model_years'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '144-1064')
      .executeTakeFirstOrThrow()
    expect(toyotaAfter).toEqual({
      id: toyotaBefore.id,
      available_model_years: [2015, 2016, 2017, 2018],
    })

    const withoutFiat = makeSnapshot('fixture-3')
    withoutFiat.records = withoutFiat.records.filter((row) => row.sourceKey !== '100-0001')
    const deactivated = await importVehicleSourceSnapshot(db, withoutFiat)
    expect(deactivated.counts.deactivated).toBe(1)

    const fiatInactive = await db.selectFrom('vehicle_source_records')
      .select(['id', 'active'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '100-0001')
      .executeTakeFirstOrThrow()
    expect(fiatInactive.active).toBe(false)

    const reactivated = await importVehicleSourceSnapshot(db, makeSnapshot('fixture-4'))
    expect(reactivated.counts.reactivated).toBe(1)
    const fiatActive = await db.selectFrom('vehicle_source_records')
      .select(['id', 'active'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '100-0001')
      .executeTakeFirstOrThrow()
    expect(fiatActive).toEqual({ id: fiatInactive.id, active: true })
  })

  it('marks only materially changed mapped source identities for review', async () => {
    const first = await importVehicleSourceSnapshot(db, makeSnapshot())
    const source = await db.selectFrom('vehicle_source_records')
      .select(['id'])
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '144-1064')
      .executeTakeFirstOrThrow()
    const model = await seedCanonicalModel()
    await db.insertInto('vehicle_source_mappings').values({
      source_record_id: source.id,
      vehicle_model_id: model.id,
      mapping_method: 'manual',
    }).execute()

    await importVehicleSourceSnapshot(db, makeSnapshot('fixture-2', {
      '144-1064': {
        brandRaw: ' toyota ',
        typeRaw: 'corolla   1.33 life',
      },
    }))

    const afterCosmeticChange = await db.selectFrom('vehicle_source_records')
      .select('mapping_needs_review')
      .where('id', '=', source.id)
      .executeTakeFirstOrThrow()
    expect(afterCosmeticChange.mapping_needs_review).toBe(false)

    const changed = await importVehicleSourceSnapshot(db, makeSnapshot('fixture-3', {
      '144-1064': { typeRaw: 'COROLLA 1.5 LIFE' },
    }))
    expect(changed.counts.reviewRequiredSet).toBe(1)

    const afterMeaningfulChange = await db.selectFrom('vehicle_source_records')
      .select('mapping_needs_review')
      .where('id', '=', source.id)
      .executeTakeFirstOrThrow()
    expect(afterMeaningfulChange.mapping_needs_review).toBe(true)

    await importVehicleSourceSnapshot(db, makeSnapshot('fixture-4', {
      '144-1064': { typeRaw: 'COROLLA 1.6 LIFE' },
    }))
    const stillReviewRequired = await db.selectFrom('vehicle_source_records')
      .select('mapping_needs_review')
      .where('id', '=', source.id)
      .executeTakeFirstOrThrow()
    expect(stillReviewRequired.mapping_needs_review).toBe(true)
  })

  it('never manufactures mappings for changed unmapped source records', async () => {
    const first = await importVehicleSourceSnapshot(db, makeSnapshot())
    const source = await db.selectFrom('vehicle_source_records')
      .select('id')
      .where('provider_id', '=', first.providerId)
      .where('source_key', '=', '122-1260')
      .executeTakeFirstOrThrow()

    await importVehicleSourceSnapshot(db, makeSnapshot('fixture-2', {
      '122-1260': { typeRaw: 'CLIO TECHNO 1.0 TCE X-TRONIC 90' },
    }))

    const mapping = await db.selectFrom('vehicle_source_mappings')
      .select('source_record_id')
      .where('source_record_id', '=', source.id)
      .executeTakeFirst()
    expect(mapping).toBeUndefined()

    const row = await db.selectFrom('vehicle_source_records')
      .select('mapping_needs_review')
      .where('id', '=', source.id)
      .executeTakeFirstOrThrow()
    expect(row.mapping_needs_review).toBe(false)
  })

  it('rejects an empty snapshot before working source data can change', async () => {
    await importVehicleSourceSnapshot(db, makeSnapshot())
    const before = await db.selectFrom('vehicle_source_records')
      .select(['source_key', 'active'])
      .orderBy('source_key')
      .execute()

    expect(() => validateAndNormalizeVehicleSourceSnapshot({
      provider: {
        code: 'tsb-kasko',
        sourceName: 'TSB integration fixture',
        version: 'empty',
      },
      records: [],
    }, fixedNow)).toThrow(VehicleSourceValidationError)

    const after = await db.selectFrom('vehicle_source_records')
      .select(['source_key', 'active'])
      .orderBy('source_key')
      .execute()
    expect(after).toEqual(before)
  })
})
