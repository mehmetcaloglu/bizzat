import {
  normalizeVehicleSourceIdentity,
  normalizeVehicleSourceText,
} from '../source/source-normalization.js'
import type {
  VehicleBrandAliasesFile,
  VehicleSeriesAliasesFile,
} from './alias.types.js'

export class VehicleAliasValidationError extends Error {
  readonly code = 'VEHICLE_ALIAS_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'VehicleAliasValidationError'
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
    throw new VehicleAliasValidationError(`${label} must be a string`)
  }

  const normalized = normalizeVehicleSourceText(value)
  if (!normalized) {
    throw new VehicleAliasValidationError(`${label} must not be blank`)
  }
  return normalized
}

export function validateVehicleBrandAliases(value: unknown): VehicleBrandAliasesFile {
  if (!isObject(value)) {
    throw new VehicleAliasValidationError('Brand aliases file must be an object')
  }

  const version = requiredString(value, 'version', 'version')
  if (!Array.isArray(value.aliases)) {
    throw new VehicleAliasValidationError('aliases must be an array')
  }

  const seenAliases = new Set<string>()
  const aliases: VehicleBrandAliasesFile['aliases'] = []

  for (const [index, aliasValue] of value.aliases.entries()) {
    if (!isObject(aliasValue)) {
      throw new VehicleAliasValidationError(`aliases[${index}] must be an object`)
    }

    const raw = requiredString(aliasValue, 'raw', `aliases[${index}].raw`)
    const brandKey = requiredString(aliasValue, 'brandKey', `aliases[${index}].brandKey`)
    const normalizedRaw = normalizeVehicleSourceIdentity(raw)
    if (seenAliases.has(normalizedRaw)) {
      throw new VehicleAliasValidationError(`Duplicate normalized brand alias: ${raw}`)
    }
    seenAliases.add(normalizedRaw)
    aliases.push({ raw, brandKey })
  }

  return { version, aliases }
}

export function validateVehicleSeriesAliases(value: unknown): VehicleSeriesAliasesFile {
  if (!isObject(value)) {
    throw new VehicleAliasValidationError('Series aliases file must be an object')
  }

  const version = requiredString(value, 'version', 'version')
  if (!Array.isArray(value.entries)) {
    throw new VehicleAliasValidationError('entries must be an array')
  }

  const aliasOwners = new Map<string, string>()
  const entries: VehicleSeriesAliasesFile['entries'] = []

  for (const [index, entryValue] of value.entries.entries()) {
    if (!isObject(entryValue)) {
      throw new VehicleAliasValidationError(`entries[${index}] must be an object`)
    }

    const brandKey = requiredString(entryValue, 'brandKey', `entries[${index}].brandKey`)
    const seriesKey = requiredString(entryValue, 'seriesKey', `entries[${index}].seriesKey`)
    if (!Array.isArray(entryValue.aliases) || entryValue.aliases.length === 0) {
      throw new VehicleAliasValidationError(`entries[${index}].aliases must be non-empty`)
    }

    const aliases: string[] = []
    const seenWithinEntry = new Set<string>()
    for (const [aliasIndex, aliasValue] of entryValue.aliases.entries()) {
      if (typeof aliasValue !== 'string') {
        throw new VehicleAliasValidationError(
          `entries[${index}].aliases[${aliasIndex}] must be a string`,
        )
      }
      const alias = normalizeVehicleSourceText(aliasValue)
      if (!alias) {
        throw new VehicleAliasValidationError(
          `entries[${index}].aliases[${aliasIndex}] must not be blank`,
        )
      }

      const normalizedAlias = normalizeVehicleSourceIdentity(alias)
      const withinEntryKey = `${brandKey}\u0000${normalizedAlias}`
      if (seenWithinEntry.has(withinEntryKey)) continue
      seenWithinEntry.add(withinEntryKey)

      const ownerKey = `${brandKey}\u0000${normalizedAlias}`
      const owner = aliasOwners.get(ownerKey)
      if (owner && owner !== seriesKey) {
        throw new VehicleAliasValidationError(
          `Series alias ${alias} maps to multiple series within brand ${brandKey}`,
        )
      }
      aliasOwners.set(ownerKey, seriesKey)
      aliases.push(alias)
    }

    entries.push({ brandKey, seriesKey, aliases })
  }

  return { version, entries }
}
