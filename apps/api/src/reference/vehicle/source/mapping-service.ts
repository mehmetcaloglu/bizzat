import type { Kysely } from 'kysely'
import type { Database } from '../../../db/client.js'
import type {
  VehicleSourceMappingApplyResult,
  VehicleSourceMappingFile,
} from './mapping.types.js'

export async function applyVehicleSourceMappings(
  db: Kysely<Database>,
  providerCode: 'tsb-kasko',
  file: VehicleSourceMappingFile,
): Promise<VehicleSourceMappingApplyResult> {
  const now = new Date()

  return db.transaction().execute(async (trx) => {
    const provider = await trx
      .selectFrom('vehicle_source_providers')
      .select('id')
      .where('code', '=', providerCode)
      .executeTakeFirst()
    if (!provider) {
      throw new Error(`Vehicle source provider not found: ${providerCode}`)
    }

    for (const mapping of file.mappings) {
      const source = await trx
        .selectFrom('vehicle_source_records')
        .select('id')
        .where('provider_id', '=', provider.id)
        .where('source_key', '=', mapping.sourceKey)
        .executeTakeFirst()
      if (!source) {
        throw new Error(`Vehicle source record not found: ${mapping.sourceKey}`)
      }

      const model = await trx
        .selectFrom('vehicle_models')
        .select('id')
        .where('catalog_key', '=', mapping.vehicleModelKey)
        .where('active', '=', true)
        .executeTakeFirst()
      if (!model) {
        throw new Error(`Active canonical vehicle model not found: ${mapping.vehicleModelKey}`)
      }

      await trx
        .insertInto('vehicle_source_mappings')
        .values({
          source_record_id: source.id,
          vehicle_model_id: model.id,
          mapping_method: mapping.method,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column('source_record_id').doUpdateSet({
            vehicle_model_id: model.id,
            mapping_method: mapping.method,
            updated_at: now,
          }),
        )
        .execute()

      await trx
        .updateTable('vehicle_source_records')
        .set({ mapping_needs_review: false, updated_at: now })
        .where('id', '=', source.id)
        .execute()
    }

    return { applied: file.mappings.length }
  })
}
