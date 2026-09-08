import type { VehicleMappingMethod } from '../../../db/client.js'
import type { VehicleSourceMappingFile } from './mapping.types.js'

const allowedMethods = new Set<VehicleMappingMethod>([
  'manual',
  'exact-rule',
  'curated-import',
])

export class VehicleSourceMappingValidationError extends Error {
  readonly code = 'VEHICLE_SOURCE_MAPPING_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'VehicleSourceMappingValidationError'
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
    throw new VehicleSourceMappingValidationError(`${label} must be a string`)
  }
  const normalized = value.trim()
  if (!normalized) {
    throw new VehicleSourceMappingValidationError(`${label} must not be blank`)
  }
  return normalized
}

export function validateVehicleSourceMappingFile(value: unknown): VehicleSourceMappingFile {
  if (!isObject(value)) {
    throw new VehicleSourceMappingValidationError('Mapping file must be an object')
  }

  const version = requiredString(value, 'version', 'version')
  if (!Array.isArray(value.mappings)) {
    throw new VehicleSourceMappingValidationError('mappings must be an array')
  }

  const seenSourceKeys = new Set<string>()
  const mappings: VehicleSourceMappingFile['mappings'] = []

  for (const [index, mappingValue] of value.mappings.entries()) {
    if (!isObject(mappingValue)) {
      throw new VehicleSourceMappingValidationError(`mappings[${index}] must be an object`)
    }

    const sourceKey = requiredString(mappingValue, 'sourceKey', `mappings[${index}].sourceKey`)
    const vehicleModelKey = requiredString(
      mappingValue,
      'vehicleModelKey',
      `mappings[${index}].vehicleModelKey`,
    )
    const methodValue = mappingValue.method
    if (typeof methodValue !== 'string' || !allowedMethods.has(methodValue as VehicleMappingMethod)) {
      throw new VehicleSourceMappingValidationError(`mappings[${index}].method is invalid`)
    }

    if (seenSourceKeys.has(sourceKey)) {
      throw new VehicleSourceMappingValidationError(`Duplicate sourceKey: ${sourceKey}`)
    }
    seenSourceKeys.add(sourceKey)

    mappings.push({
      sourceKey,
      vehicleModelKey,
      method: methodValue as VehicleMappingMethod,
    })
  }

  return { version, mappings }
}
