import type { Kysely } from 'kysely'
import type { Database } from '../../db/client.js'
import { checksumLocationSnapshot } from './location-checksum.js'
import type { NormalizedLocationSnapshot } from './location-import.types.js'
import { validateLocationSnapshot } from './location-validator.js'

export interface LocationImportResult {
  providerId: string
  importId: string
  checksum: string
  counts: {
    provinces: number
    districts: number
    neighborhoods: number
  }
}

export async function importLocationSnapshot(
  db: Kysely<Database>,
  snapshot: NormalizedLocationSnapshot,
): Promise<LocationImportResult> {
  validateLocationSnapshot(snapshot)
  const checksum = checksumLocationSnapshot(snapshot)
  const now = new Date()

  return db.transaction().execute(async (trx) => {
    const provider = await trx
      .insertInto('reference_data_providers')
      .values({
        code: snapshot.provider.code.trim(),
        source_name: snapshot.provider.sourceName.trim(),
        source_url: snapshot.provider.sourceUrl?.trim() ?? null,
        license: snapshot.provider.license?.trim() ?? null,
      })
      .onConflict((oc) =>
        oc.column('code').doUpdateSet({
          source_name: snapshot.provider.sourceName.trim(),
          source_url: snapshot.provider.sourceUrl?.trim() ?? null,
          license: snapshot.provider.license?.trim() ?? null,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow()

    // Only one operational location provider should expose active rows at a time.
    // Historical rows are retained for referential integrity.
    await trx
      .updateTable('neighborhoods')
      .set({ active: false, updated_at: now })
      .where('provider_id', '!=', provider.id)
      .where('active', '=', true)
      .execute()
    await trx
      .updateTable('districts')
      .set({ active: false, updated_at: now })
      .where('provider_id', '!=', provider.id)
      .where('active', '=', true)
      .execute()
    await trx
      .updateTable('provinces')
      .set({ active: false, updated_at: now })
      .where('provider_id', '!=', provider.id)
      .where('active', '=', true)
      .execute()

    const importRow = await trx
      .insertInto('reference_data_imports')
      .values({
        provider_id: provider.id,
        version: snapshot.provider.version.trim(),
        checksum_sha256: checksum,
      })
      .onConflict((oc) => oc.columns(['provider_id', 'version', 'checksum_sha256']).doNothing())
      .returning('id')
      .executeTakeFirst()

    const importId = importRow?.id ?? (
      await trx
        .selectFrom('reference_data_imports')
        .select('id')
        .where('provider_id', '=', provider.id)
        .where('version', '=', snapshot.provider.version.trim())
        .where('checksum_sha256', '=', checksum)
        .executeTakeFirstOrThrow()
    ).id

    const provinceIds = new Map<string, string>()
    for (const province of snapshot.provinces) {
      const row = await trx
        .insertInto('provinces')
        .values({
          provider_id: provider.id,
          source_key: province.sourceKey.trim(),
          code: province.code.trim(),
          name: province.name.trim(),
          active: true,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.columns(['provider_id', 'source_key']).doUpdateSet({
            code: province.code.trim(),
            name: province.name.trim(),
            active: true,
            updated_at: now,
          }),
        )
        .returning(['id', 'source_key'])
        .executeTakeFirstOrThrow()
      provinceIds.set(row.source_key, row.id)
    }

    const districtIds = new Map<string, string>()
    for (const district of snapshot.districts) {
      const provinceId = provinceIds.get(district.provinceSourceKey.trim())
      if (!provinceId) throw new Error(`Missing imported province: ${district.provinceSourceKey}`)
      const row = await trx
        .insertInto('districts')
        .values({
          provider_id: provider.id,
          source_key: district.sourceKey.trim(),
          province_id: provinceId,
          name: district.name.trim(),
          active: true,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.columns(['provider_id', 'source_key']).doUpdateSet({
            province_id: provinceId,
            name: district.name.trim(),
            active: true,
            updated_at: now,
          }),
        )
        .returning(['id', 'source_key'])
        .executeTakeFirstOrThrow()
      districtIds.set(row.source_key, row.id)
    }

    for (const neighborhood of snapshot.neighborhoods) {
      const districtId = districtIds.get(neighborhood.districtSourceKey.trim())
      if (!districtId) throw new Error(`Missing imported district: ${neighborhood.districtSourceKey}`)
      await trx
        .insertInto('neighborhoods')
        .values({
          provider_id: provider.id,
          source_key: neighborhood.sourceKey.trim(),
          district_id: districtId,
          name: neighborhood.name.trim(),
          kind: neighborhood.kind?.trim() ?? null,
          active: true,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.columns(['provider_id', 'source_key']).doUpdateSet({
            district_id: districtId,
            name: neighborhood.name.trim(),
            kind: neighborhood.kind?.trim() ?? null,
            active: true,
            updated_at: now,
          }),
        )
        .execute()
    }

    const provinceKeys = snapshot.provinces.map((row) => row.sourceKey.trim())
    const districtKeys = snapshot.districts.map((row) => row.sourceKey.trim())
    const neighborhoodKeys = snapshot.neighborhoods.map((row) => row.sourceKey.trim())

    await trx
      .updateTable('neighborhoods')
      .set({ active: false, updated_at: now })
      .where('provider_id', '=', provider.id)
      .where('source_key', 'not in', neighborhoodKeys)
      .execute()
    await trx
      .updateTable('districts')
      .set({ active: false, updated_at: now })
      .where('provider_id', '=', provider.id)
      .where('source_key', 'not in', districtKeys)
      .execute()
    await trx
      .updateTable('provinces')
      .set({ active: false, updated_at: now })
      .where('provider_id', '=', provider.id)
      .where('source_key', 'not in', provinceKeys)
      .execute()

    return {
      providerId: provider.id,
      importId,
      checksum,
      counts: {
        provinces: snapshot.provinces.length,
        districts: snapshot.districts.length,
        neighborhoods: snapshot.neighborhoods.length,
      },
    }
  })
}
