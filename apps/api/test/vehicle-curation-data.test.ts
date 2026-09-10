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

  it('covers the CI fixture targets and the reviewed marketplace paths', async () => {
    const catalog = await json('catalog.json')
    validateVehicleCatalog(catalog)
    const models = new Map(catalog.models.map((model) => [model.key, model]))
    const fixtureMappings = validateVehicleSourceMappingFile(await json('fixture.tsb-mappings.json'))
    for (const mapping of fixtureMappings.mappings) expect(models.has(mapping.vehicleModelKey)).toBe(true)
    expect(catalog.brands.map((brand) => brand.key)).toEqual(expect.arrayContaining(['renault', 'fiat', 'volkswagen', 'peugeot', 'bmw', 'mercedes-benz', 'audi', 'tesla']))
    expect(models.get('renault:clio:1-0-tce-evolution')?.selectionPath?.map((node) => node.name)).toEqual(['1.0 TCe', 'Evolution'])
    expect(models.get('audi:a3:a3-sedan-35-tfsi-advanced')?.selectionPath?.map((node) => node.name)).toEqual(['A3 Sedan', '35 TFSI', 'Advanced'])
    expect(models.get('tesla:model-3:long-range')?.selectionPath?.map((node) => node.name)).toEqual(['Long Range'])
    expect(models.has('bmw:3-serisi:320i-ed-sport-line')).toBe(true)
    expect(models.has('bmw:3-serisi:320i-sport-line')).toBe(true)
    expect(models.has('renault:clio:0-9-tce-sport-tourer-joy')).toBe(true)
    const mappings = validateVehicleSourceMappingFile(await json('tsb-mappings.json'))
    expect(mappings.mappings.find((mapping) => mapping.sourceKey === '122-1260')?.vehicleModelKey).toBe('renault:clio:1-0-tce-evolution')
    expect(mappings.mappings.find((mapping) => mapping.sourceKey === '122-1266')?.vehicleModelKey).toBe('renault:clio:1-0-tce-evolution')
  })

  it('publishes only the reviewed Megane coverage increment', async () => {
    const catalog = await json('catalog.json')
    validateVehicleCatalog(catalog)
    const models = new Map(catalog.models.map((model) => [model.key, model]))
    const mappings = validateVehicleSourceMappingFile(await json('tsb-mappings.json'))
    const targets = new Map(mappings.mappings.map((mapping) => [mapping.sourceKey, mapping.vehicleModelKey]))
    const backlog = await json('curation-backlog.json') as {
      series: Array<{
        seriesKey: string
        sourceRecords: number
        mappedSourceCodes: number
        modelReviewRequired: number
        excludedSourceCodes: number
        selectableModels: number
      }>
    }

    expect(catalog.series).toEqual(expect.arrayContaining([
      { key: 'renault:megane', brandKey: 'renault', name: 'Megane' },
    ]))
    expect(models.get('renault:megane:1-5-dci-icon')?.selectionPath?.map((node) => node.name)).toEqual(['1.5 dCi', 'Icon'])
    expect(models.get('renault:megane:1-5-dci-joy')?.selectionPath?.map((node) => node.name)).toEqual(['1.5 dCi', 'Joy'])
    expect(models.get('renault:megane:1-5-dci-gt-line')?.selectionPath?.map((node) => node.name)).toEqual(['1.5 dCi', 'GT Line'])
    expect(models.get('renault:megane:1-6-joy')?.selectionPath?.map((node) => node.name)).toEqual(['1.6', 'Joy'])

    expect(targets.get('122-1161')).toBe('renault:megane:1-5-dci-icon')
    expect(targets.get('122-1160')).toBe('renault:megane:1-5-dci-icon')
    expect(targets.get('122-1107')).toBe('renault:megane:1-5-dci-joy')
    expect(targets.get('122-1108')).toBe('renault:megane:1-5-dci-joy')
    expect(targets.get('122-1088')).toBe('renault:megane:1-5-dci-gt-line')
    expect(targets.get('122-1089')).toBe('renault:megane:1-5-dci-gt-line')
    expect(targets.get('122-1105')).toBe('renault:megane:1-6-joy')
    expect(targets.get('122-1106')).toBe('renault:megane:1-6-joy')

    expect(backlog.series.find((entry) => entry.seriesKey === 'renault:megane')).toEqual({
      seriesKey: 'renault:megane',
      sourceRecords: 187,
      mappedSourceCodes: 8,
      modelReviewRequired: 179,
      excludedSourceCodes: 0,
      selectableModels: 4,
    })
  })

  it('keeps operational leaves explicit and technical source notation out of picker labels', async () => {
    const catalog = await json('catalog.json')
    validateVehicleCatalog(catalog)
    for (const model of catalog.models) {
      expect(model.selectionPath?.length).toBeGreaterThan(0)
      expect(model.selectionPath?.at(-1)?.key).toBe(model.key)
      expect(model.name).not.toMatch(/\b(?:X-TRONIC|DSG|EDC|EAT8|7G-TRONIC|EURO6|FAZ1|\d+ HP)\b/i)
    }
  })

})
