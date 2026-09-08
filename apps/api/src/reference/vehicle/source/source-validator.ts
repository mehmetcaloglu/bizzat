import {
  normalizeVehicleSourceText,
  normalizeVehicleSourceYears,
} from './source-normalization.js'
import type { NormalizedVehicleSourceSnapshot } from './source.types.js'

export class VehicleSourceValidationError extends Error {
  readonly code = 'VEHICLE_SOURCE_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'VehicleSourceValidationError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = object[key]
  if (typeof value !== 'string') {
    throw new VehicleSourceValidationError(`${label} must be a string`)
  }

  const normalized = normalizeVehicleSourceText(value)
  if (!normalized) {
    throw new VehicleSourceValidationError(`${label} must not be blank`)
  }
  return normalized
}

export function validateAndNormalizeVehicleSourceSnapshot(
  value: unknown,
  now = new Date(),
): NormalizedVehicleSourceSnapshot {
  if (!isObject(value)) {
    throw new VehicleSourceValidationError('Snapshot must be an object')
  }

  const providerValue = value.provider
  if (!isObject(providerValue)) {
    throw new VehicleSourceValidationError('provider must be an object')
  }

  const code = requiredString(providerValue, 'code', 'provider.code')
  if (code !== 'tsb-kasko') {
    throw new VehicleSourceValidationError('provider.code must be tsb-kasko')
  }

  const sourceName = requiredString(providerValue, 'sourceName', 'provider.sourceName')
  const version = requiredString(providerValue, 'version', 'provider.version')
  const sourceUrlValue = providerValue.sourceUrl
  let sourceUrl: string | undefined
  if (sourceUrlValue !== undefined) {
    if (typeof sourceUrlValue !== 'string') {
      throw new VehicleSourceValidationError('provider.sourceUrl must be a string')
    }
    const normalizedUrl = normalizeVehicleSourceText(sourceUrlValue)
    if (normalizedUrl) sourceUrl = normalizedUrl
  }

  if (!Array.isArray(value.records) || value.records.length === 0) {
    throw new VehicleSourceValidationError('records must be a non-empty array')
  }

  const maxYear = now.getUTCFullYear() + 1
  const sourceKeys = new Set<string>()
  const records: NormalizedVehicleSourceSnapshot['records'] = []

  for (const [index, recordValue] of value.records.entries()) {
    if (!isObject(recordValue)) {
      throw new VehicleSourceValidationError(`records[${index}] must be an object`)
    }

    const sourceKey = requiredString(recordValue, 'sourceKey', `records[${index}].sourceKey`)
    const brandRaw = requiredString(recordValue, 'brandRaw', `records[${index}].brandRaw`)
    const typeRaw = requiredString(recordValue, 'typeRaw', `records[${index}].typeRaw`)

    if (sourceKeys.has(sourceKey)) {
      throw new VehicleSourceValidationError(`Duplicate sourceKey: ${sourceKey}`)
    }
    sourceKeys.add(sourceKey)

    const yearsValue = recordValue.availableModelYears
    if (!Array.isArray(yearsValue) || yearsValue.length === 0) {
      throw new VehicleSourceValidationError(
        `records[${index}].availableModelYears must be a non-empty array`,
      )
    }

    const years: number[] = []
    for (const year of yearsValue) {
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1886 || year > maxYear) {
        throw new VehicleSourceValidationError(
          `records[${index}].availableModelYears contains an invalid year`,
        )
      }
      years.push(year)
    }

    records.push({
      sourceKey,
      brandRaw,
      typeRaw,
      availableModelYears: normalizeVehicleSourceYears(years),
    })
  }

  return {
    provider: {
      code: 'tsb-kasko',
      sourceName,
      ...(sourceUrl ? { sourceUrl } : {}),
      version,
    },
    records,
  }
}
