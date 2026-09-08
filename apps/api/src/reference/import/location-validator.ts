import type { NormalizedLocationSnapshot } from './location-import.types.js'

export class LocationSnapshotValidationError extends Error {
  readonly code = 'LOCATION_SNAPSHOT_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'LocationSnapshotValidationError'
  }
}

function required(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) throw new LocationSnapshotValidationError(`${field} is required`)
  return normalized
}

function ensureUnique(values: string[], field: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new LocationSnapshotValidationError(`Duplicate ${field}: ${value}`)
    seen.add(value)
  }
}

export function validateLocationSnapshot(snapshot: NormalizedLocationSnapshot): void {
  required(snapshot.provider.code, 'provider.code')
  required(snapshot.provider.sourceName, 'provider.sourceName')
  required(snapshot.provider.version, 'provider.version')

  if (snapshot.provinces.length === 0 || snapshot.districts.length === 0 || snapshot.neighborhoods.length === 0) {
    throw new LocationSnapshotValidationError('Location hierarchy must not be empty')
  }

  const provinceKeys = snapshot.provinces.map((province) => required(province.sourceKey, 'province.sourceKey'))
  const provinceCodes = snapshot.provinces.map((province) => required(province.code, 'province.code'))
  ensureUnique(provinceKeys, 'province source key')
  ensureUnique(provinceCodes, 'province code')
  snapshot.provinces.forEach((province) => required(province.name, 'province.name'))

  const provinceKeySet = new Set(provinceKeys)
  const districtKeys = snapshot.districts.map((district) => required(district.sourceKey, 'district.sourceKey'))
  ensureUnique(districtKeys, 'district source key')
  for (const district of snapshot.districts) {
    required(district.name, 'district.name')
    const parent = required(district.provinceSourceKey, 'district.provinceSourceKey')
    if (!provinceKeySet.has(parent)) {
      throw new LocationSnapshotValidationError(`Unknown province source key: ${parent}`)
    }
  }

  const districtKeySet = new Set(districtKeys)
  const neighborhoodKeys = snapshot.neighborhoods.map((neighborhood) => required(neighborhood.sourceKey, 'neighborhood.sourceKey'))
  ensureUnique(neighborhoodKeys, 'neighborhood source key')
  for (const neighborhood of snapshot.neighborhoods) {
    required(neighborhood.name, 'neighborhood.name')
    const parent = required(neighborhood.districtSourceKey, 'neighborhood.districtSourceKey')
    if (!districtKeySet.has(parent)) {
      throw new LocationSnapshotValidationError(`Unknown district source key: ${parent}`)
    }
  }
}
