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
    const brandAliases = await json('brand-aliases.json')
    const seriesAliases = await json('series-aliases.json')
    const catalog = await json('catalog.json')
    const mappings = await json('tsb-mappings.json')

    expect(() => validateVehicleBrandAliases(brandAliases)).not.toThrow()
    expect(() => validateVehicleSeriesAliases(seriesAliases)).not.toThrow()
    expect(() => validateVehicleCatalog(catalog)).not.toThrow()
    expect(() => validateVehicleSourceMappingFile(mappings)).not.toThrow()
  })

  it('keeps every committed TSB mapping pointed at an existing canonical model', async () => {
    const catalog = await json('catalog.json')
    validateVehicleCatalog(catalog)
    const mappings = validateVehicleSourceMappingFile(await json('tsb-mappings.json'))
    const modelKeys = new Set(catalog.models.map((model) => model.key))

    const missingTargets = mappings.mappings
      .filter((mapping) => !modelKeys.has(mapping.vehicleModelKey))
      .map((mapping) => ({
        sourceKey: mapping.sourceKey,
        vehicleModelKey: mapping.vehicleModelKey,
      }))

    expect(missingTargets).toEqual([])
  })

  it('keeps the source manifest counts aligned with committed catalog and mappings', async () => {
    const catalog = await json('catalog.json')
    validateVehicleCatalog(catalog)
    const mappings = validateVehicleSourceMappingFile(await json('tsb-mappings.json'))
    const manifest = await json('source-manifest.json') as {
      sources: Array<{ name: string; sourcePeriod?: string }>
      curation: {
        tsbSnapshotRecords: number
        mappedSourceCodes: number
        canonicalBrands: number
        canonicalSeries: number
        canonicalModels: number
        slugCollisionsExcluded: number
        ambiguousSeriesExcluded: number
      }
    }

    expect(manifest.curation).toMatchObject({
      mappedSourceCodes: mappings.mappings.length,
      canonicalBrands: catalog.brands.length,
      canonicalSeries: catalog.series.length,
      canonicalModels: catalog.models.length,
    })
    expect(manifest.curation.tsbSnapshotRecords).toBeGreaterThanOrEqual(mappings.mappings.length)
    expect(manifest.curation.slugCollisionsExcluded).toBeGreaterThanOrEqual(0)
    expect(manifest.curation.ambiguousSeriesExcluded).toBeGreaterThanOrEqual(0)

    const tsb = manifest.sources.find((source) => source.name.includes('Türkiye Sigorta Birliği'))
    expect(tsb?.sourcePeriod).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/)
  })

  it('keeps canonical and mapping artifacts free of provider-only payload fields', async () => {
    const catalog = JSON.stringify(await json('catalog.json'))
    const mappings = JSON.stringify(await json('tsb-mappings.json'))

    expect(catalog).not.toMatch(/sourceKey|brandRaw|typeRaw|availableModelYears|kasko|price/i)
    expect(mappings).not.toMatch(/brandRaw|typeRaw|availableModelYears|kasko|price/i)
  })
})
