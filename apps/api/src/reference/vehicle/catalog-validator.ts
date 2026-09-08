import type {
  CanonicalVehicleBrand,
  CanonicalVehicleCatalog,
  CanonicalVehicleModel,
  CanonicalVehicleSeries,
} from './catalog.types.js'

export class VehicleCatalogValidationError extends Error {
  readonly code = 'VEHICLE_CATALOG_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'VehicleCatalogValidationError'
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new VehicleCatalogValidationError(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new VehicleCatalogValidationError(`${label} must be an array`)
  }
  return value
}

function parseBrand(value: unknown, index: number): CanonicalVehicleBrand {
  if (!isRecord(value)) {
    throw new VehicleCatalogValidationError(`brands[${index}] must be an object`)
  }
  return {
    key: requireNonEmptyString(value.key, `brands[${index}].key`),
    name: requireNonEmptyString(value.name, `brands[${index}].name`),
  }
}

function parseSeries(value: unknown, index: number): CanonicalVehicleSeries {
  if (!isRecord(value)) {
    throw new VehicleCatalogValidationError(`series[${index}] must be an object`)
  }
  return {
    key: requireNonEmptyString(value.key, `series[${index}].key`),
    brandKey: requireNonEmptyString(value.brandKey, `series[${index}].brandKey`),
    name: requireNonEmptyString(value.name, `series[${index}].name`),
  }
}

function parseModel(value: unknown, index: number): CanonicalVehicleModel {
  if (!isRecord(value)) {
    throw new VehicleCatalogValidationError(`models[${index}] must be an object`)
  }
  return {
    key: requireNonEmptyString(value.key, `models[${index}].key`),
    seriesKey: requireNonEmptyString(value.seriesKey, `models[${index}].seriesKey`),
    name: requireNonEmptyString(value.name, `models[${index}].name`),
  }
}

function assertUnique(keys: string[], label: string): void {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      throw new VehicleCatalogValidationError(`Duplicate ${label} key: ${key}`)
    }
    seen.add(key)
  }
}

export function validateVehicleCatalog(value: unknown): asserts value is CanonicalVehicleCatalog {
  if (!isRecord(value)) {
    throw new VehicleCatalogValidationError('Catalog must be an object')
  }

  requireNonEmptyString(value.version, 'version')
  const brands = requireArray(value.brands, 'brands').map(parseBrand)
  const series = requireArray(value.series, 'series').map(parseSeries)
  const models = requireArray(value.models, 'models').map(parseModel)

  assertUnique(brands.map((item) => item.key), 'brand')
  assertUnique(series.map((item) => item.key), 'series')
  assertUnique(models.map((item) => item.key), 'model')

  const brandKeys = new Set(brands.map((item) => item.key))
  for (const item of series) {
    if (!brandKeys.has(item.brandKey)) {
      throw new VehicleCatalogValidationError(`Unknown brandKey for series ${item.key}: ${item.brandKey}`)
    }
  }

  const seriesKeys = new Set(series.map((item) => item.key))
  for (const item of models) {
    if (!seriesKeys.has(item.seriesKey)) {
      throw new VehicleCatalogValidationError(`Unknown seriesKey for model ${item.key}: ${item.seriesKey}`)
    }
  }
}
