import type {
  CanonicalVehicleBrand,
  CanonicalVehicleCatalog,
  CanonicalVehicleModel,
  CanonicalVehicleSeries,
  VehicleSelectionNode,
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
  const model: CanonicalVehicleModel = {
    key: requireNonEmptyString(value.key, `models[${index}].key`),
    seriesKey: requireNonEmptyString(value.seriesKey, `models[${index}].seriesKey`),
    name: requireNonEmptyString(value.name, `models[${index}].name`),
  }

  if (value.selectionPath !== undefined) {
    const path = requireArray(value.selectionPath, `models[${index}].selectionPath`)
    if (path.length === 0) {
      throw new VehicleCatalogValidationError(`models[${index}].selectionPath must not be empty`)
    }
    model.selectionPath = path.map((node, nodeIndex): VehicleSelectionNode => {
      if (!isRecord(node)) {
        throw new VehicleCatalogValidationError(
          `models[${index}].selectionPath[${nodeIndex}] must be an object`,
        )
      }
      return {
        key: requireNonEmptyString(
          node.key,
          `models[${index}].selectionPath[${nodeIndex}].key`,
        ),
        name: requireNonEmptyString(
          node.name,
          `models[${index}].selectionPath[${nodeIndex}].name`,
        ),
      }
    })

    const terminal = model.selectionPath.at(-1)!
    if (terminal.key !== model.key) {
      throw new VehicleCatalogValidationError(
        `models[${index}].selectionPath terminal key must equal model key ${model.key}`,
      )
    }

    const pathKeys = model.selectionPath.map((node) => node.key)
    if (new Set(pathKeys).size !== pathKeys.length) {
      throw new VehicleCatalogValidationError(
        `models[${index}].selectionPath must not contain duplicate keys`,
      )
    }
  }

  return model
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

  const nodes = new Map<string, {
    seriesKey: string
    name: string
    parentKeys: string[]
    terminal: boolean
  }>()
  const siblingLabels = new Map<string, string>()
  for (const item of models) {
    const selectionPath = item.selectionPath ?? [{ key: item.key, name: item.name }]

    for (const [nodeIndex, node] of selectionPath.entries()) {
      const parentKeys = selectionPath.slice(0, nodeIndex).map((parent) => parent.key)
      const terminal = nodeIndex === selectionPath.length - 1
      const siblingLabelKey = JSON.stringify([item.seriesKey, parentKeys, node.name])
      const siblingKey = siblingLabels.get(siblingLabelKey)
      if (siblingKey !== undefined && siblingKey !== node.key) {
        throw new VehicleCatalogValidationError(
          `Duplicate selection label under one parent: ${node.name}`,
        )
      }
      siblingLabels.set(siblingLabelKey, node.key)

      const existing = nodes.get(node.key)
      if (!existing) {
        nodes.set(node.key, { seriesKey: item.seriesKey, name: node.name, parentKeys, terminal })
        continue
      }

      const samePath = existing.parentKeys.length === parentKeys.length
        && existing.parentKeys.every((parentKey, index) => parentKey === parentKeys[index])
      if (
        existing.seriesKey !== item.seriesKey
        || existing.name !== node.name
        || !samePath
      ) {
        throw new VehicleCatalogValidationError(
          `Conflicting metadata or path for selection node ${node.key}`,
        )
      }
      if (existing.terminal !== terminal) {
        throw new VehicleCatalogValidationError(
          `Selection node ${node.key} cannot be both terminal and a branch`,
        )
      }
    }
  }
}
