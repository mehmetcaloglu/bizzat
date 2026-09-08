import type { Kysely } from 'kysely'
import type { Database } from '../../../db/client.js'
import { checksumVehicleSourceSnapshot } from './source-checksum.js'
import { normalizeVehicleSourceIdentity } from './source-normalization.js'
import type {
  NormalizedVehicleSourceSnapshot,
  VehicleSourceImportResult,
} from './source.types.js'

function sameYears(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((year, index) => year === right[index])
}

export async function importVehicleSourceSnapshot(
  db: Kysely<Database>,
  snapshot: NormalizedVehicleSourceSnapshot,
): Promise<VehicleSourceImportResult> {
  if (snapshot.records.length === 0) {
    throw new Error('Vehicle source snapshot must not be empty')
  }

  const checksum = checksumVehicleSourceSnapshot(snapshot)
  const now = new Date()

  return db.transaction().execute(async (trx) => {
    const provider = await trx
      .insertInto('vehicle_source_providers')
      .values({
        code: snapshot.provider.code,
        source_name: snapshot.provider.sourceName,
        source_url: snapshot.provider.sourceUrl ?? null,
        license: null,
      })
      .onConflict((oc) =>
        oc.column('code').doUpdateSet({
          source_name: snapshot.provider.sourceName,
          source_url: snapshot.provider.sourceUrl ?? null,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow()

    const insertedImport = await trx
      .insertInto('vehicle_source_imports')
      .values({
        provider_id: provider.id,
        version: snapshot.provider.version,
        checksum_sha256: checksum,
      })
      .onConflict((oc) =>
        oc.columns(['provider_id', 'version', 'checksum_sha256']).doNothing(),
      )
      .returning('id')
      .executeTakeFirst()

    const importId = insertedImport?.id ?? (
      await trx
        .selectFrom('vehicle_source_imports')
        .select('id')
        .where('provider_id', '=', provider.id)
        .where('version', '=', snapshot.provider.version)
        .where('checksum_sha256', '=', checksum)
        .executeTakeFirstOrThrow()
    ).id

    const counts = {
      inserted: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      reviewRequiredSet: 0,
    }

    for (const record of snapshot.records) {
      const previous = await trx
        .selectFrom('vehicle_source_records')
        .select([
          'id',
          'brand_raw',
          'type_raw',
          'available_model_years',
          'active',
          'mapping_needs_review',
        ])
        .where('provider_id', '=', provider.id)
        .where('source_key', '=', record.sourceKey)
        .executeTakeFirst()

      if (!previous) {
        await trx
          .insertInto('vehicle_source_records')
          .values({
            provider_id: provider.id,
            source_key: record.sourceKey,
            brand_raw: record.brandRaw,
            type_raw: record.typeRaw,
            available_model_years: record.availableModelYears,
            active: true,
            mapping_needs_review: false,
            first_seen_import_id: importId,
            last_seen_import_id: importId,
            updated_at: now,
          })
          .execute()
        counts.inserted += 1
        continue
      }

      const mapping = await trx
        .selectFrom('vehicle_source_mappings')
        .select('source_record_id')
        .where('source_record_id', '=', previous.id)
        .executeTakeFirst()

      const identityChanged =
        normalizeVehicleSourceIdentity(previous.brand_raw) !==
          normalizeVehicleSourceIdentity(record.brandRaw) ||
        normalizeVehicleSourceIdentity(previous.type_raw) !==
          normalizeVehicleSourceIdentity(record.typeRaw)

      const metadataChanged =
        previous.brand_raw !== record.brandRaw ||
        previous.type_raw !== record.typeRaw ||
        !sameYears(previous.available_model_years, record.availableModelYears)

      const shouldRequireReview = previous.mapping_needs_review || Boolean(mapping && identityChanged)
      if (!previous.mapping_needs_review && shouldRequireReview) {
        counts.reviewRequiredSet += 1
      }

      if (!previous.active) {
        counts.reactivated += 1
      } else if (metadataChanged) {
        counts.updated += 1
      }

      await trx
        .updateTable('vehicle_source_records')
        .set({
          brand_raw: record.brandRaw,
          type_raw: record.typeRaw,
          available_model_years: record.availableModelYears,
          active: true,
          mapping_needs_review: shouldRequireReview,
          last_seen_import_id: importId,
          updated_at: now,
        })
        .where('id', '=', previous.id)
        .execute()
    }

    const currentKeys = snapshot.records.map((record) => record.sourceKey)
    const deactivatedRows = await trx
      .updateTable('vehicle_source_records')
      .set({ active: false, updated_at: now })
      .where('provider_id', '=', provider.id)
      .where('active', '=', true)
      .where('source_key', 'not in', currentKeys)
      .returning('id')
      .execute()
    counts.deactivated = deactivatedRows.length

    return {
      providerId: provider.id,
      importId,
      checksum,
      counts,
    }
  })
}
