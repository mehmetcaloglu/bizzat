import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from '../src/reference/vehicle/curation/alias-validator.js'
import { validateVehicleCatalog } from '../src/reference/vehicle/catalog-validator.js'
import { validateVehicleSourceMappingFile } from '../src/reference/vehicle/source/mapping-validator.js'

const dataDir = new URL('../../../data/reference/vehicles/', import.meta.url)

async function json(name: string): Promise<unknown> {
  return JSON.parse(await readFile(fileURLToPath(new URL(name, dataDir)), 'utf8'))
}

describe('committed vehicle curation data', () => {
  it('passes runtime validators offline', async () => {
    expect(() => validateVehicleBrandAliases(await json('brand-aliases.json'))).not.toThrow()
    expect(() => validateVehicleSeriesAliases(await json('series-aliases.json'))).not.toThrow()

    const catalog = await json('catalog.json')
    expect(() => validateVehicleCatalog(catalog)).not.toThrow()

    expect(() => validateVehicleSourceMappingFile(await json('tsb-mappings.json'))).not.toThrow()
  })
})
