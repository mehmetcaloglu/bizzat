import type { Kysely } from 'kysely'
import type { Database } from '../../../db/client.js'
import { normalizeVehicleSourceIdentity } from './source-normalization.js'

export type VehicleSourceCoverageStatus =
  | 'trusted-mapped'
  | 'unmapped'
  | 'review-required'
  | 'invalid-mapping'
  | 'inactive'

export interface VehicleSourceCoverageReport {
  provider: string
  activeRecords: number
  trustedMapped: number
  unmapped: number
  reviewRequired: number
  invalidMappings: number
  inactiveRecords: number
  details: Array<{
    sourceKey: string
    brandRaw: string
    typeRaw: string
    status: VehicleSourceCoverageStatus
    vehicleModelKey: string | null
  }>
}

export async function buildVehicleSourceCoverageReport(
  db: Kysely<Database>,
  providerCode: 'tsb-kasko',
): Promise<VehicleSourceCoverageReport> {
  const provider = await db
    .selectFrom('vehicle_source_providers')
    .select('id')
    .where('code', '=', providerCode)
    .executeTakeFirst()
  if (!provider) {
    throw new Error(`Vehicle source provider not found: ${providerCode}`)
  }

  const rows = await db
    .selectFrom('vehicle_source_records as source')
    .leftJoin(
      'vehicle_source_mappings as mapping',
      'mapping.source_record_id',
      'source.id',
    )
    .leftJoin('vehicle_models as model', 'model.id', 'mapping.vehicle_model_id')
    .select([
      'source.source_key as source_key',
      'source.brand_raw as brand_raw',
      'source.type_raw as type_raw',
      'source.active as source_active',
      'source.mapping_needs_review as mapping_needs_review',
      'mapping.source_record_id as mapped_source_id',
      'model.catalog_key as vehicle_model_key',
      'model.active as vehicle_model_active',
    ])
    .where('source.provider_id', '=', provider.id)
    .execute()

  const details = rows.map((row) => {
    let status: VehicleSourceCoverageStatus
    if (!row.source_active) {
      status = 'inactive'
    } else if (!row.mapped_source_id) {
      status = 'unmapped'
    } else if (row.mapping_needs_review) {
      status = 'review-required'
    } else if (row.vehicle_model_active !== true) {
      status = 'invalid-mapping'
    } else {
      status = 'trusted-mapped'
    }

    return {
      sourceKey: row.source_key,
      brandRaw: row.brand_raw,
      typeRaw: row.type_raw,
      status,
      vehicleModelKey: row.vehicle_model_key ?? null,
    }
  })

  details.sort((left, right) => {
    const brandComparison = normalizeVehicleSourceIdentity(left.brandRaw)
      .localeCompare(normalizeVehicleSourceIdentity(right.brandRaw))
    if (brandComparison !== 0) return brandComparison

    const typeComparison = normalizeVehicleSourceIdentity(left.typeRaw)
      .localeCompare(normalizeVehicleSourceIdentity(right.typeRaw))
    if (typeComparison !== 0) return typeComparison

    return left.sourceKey.localeCompare(right.sourceKey)
  })

  const counts = {
    trustedMapped: 0,
    unmapped: 0,
    reviewRequired: 0,
    invalidMappings: 0,
    inactiveRecords: 0,
  }

  for (const detail of details) {
    switch (detail.status) {
      case 'trusted-mapped':
        counts.trustedMapped += 1
        break
      case 'unmapped':
        counts.unmapped += 1
        break
      case 'review-required':
        counts.reviewRequired += 1
        break
      case 'invalid-mapping':
        counts.invalidMappings += 1
        break
      case 'inactive':
        counts.inactiveRecords += 1
        break
    }
  }

  return {
    provider: providerCode,
    activeRecords:
      counts.trustedMapped +
      counts.unmapped +
      counts.reviewRequired +
      counts.invalidMappings,
    trustedMapped: counts.trustedMapped,
    unmapped: counts.unmapped,
    reviewRequired: counts.reviewRequired,
    invalidMappings: counts.invalidMappings,
    inactiveRecords: counts.inactiveRecords,
    details,
  }
}
