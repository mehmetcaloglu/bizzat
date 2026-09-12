import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { validateVehicleCatalog } from '../src/reference/vehicle/catalog-validator.js'
import { validateVehicleSourceMappingFile } from '../src/reference/vehicle/source/mapping-validator.js'

const dataDir = new URL('../../../data/reference/vehicles/', import.meta.url)

async function json(name: string): Promise<unknown> {
  return JSON.parse(await readFile(fileURLToPath(new URL(name, dataDir)), 'utf8'))
}

it('publishes only the reviewed Astra 1.3 CDTI coverage increment', async () => {
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
  const manifest = await json('source-manifest.json') as {
    curation: {
      reviewedExactSelectionSeries: string[]
      reviewedTechnicalPolicySeries: string[]
    }
  }

  expect(catalog.series).toEqual(expect.arrayContaining([
    { key: 'opel:astra', brandKey: 'opel', name: 'Astra' },
  ]))
  expect(models.get('opel:astra:1-3-cdti-cosmo')?.selectionPath?.map((node) => node.name)).toEqual(['1.3 CDTI', 'Cosmo'])
  expect(models.get('opel:astra:1-3-cdti-enjoy-plus')?.selectionPath?.map((node) => node.name)).toEqual(['1.3 CDTI', 'Enjoy Plus'])
  expect(models.get('opel:astra:1-3-cdti-sport')?.selectionPath?.map((node) => node.name)).toEqual(['1.3 CDTI', 'Sport'])

  expect(targets.get('111-1011')).toBe('opel:astra:1-3-cdti-enjoy-plus')
  expect(targets.get('111-715')).toBe('opel:astra:1-3-cdti-enjoy-plus')
  expect(targets.get('111-716')).toBe('opel:astra:1-3-cdti-sport')
  expect(targets.get('111-717')).toBe('opel:astra:1-3-cdti-cosmo')

  expect(backlog.series.find((entry) => entry.seriesKey === 'opel:astra')).toEqual({
    seriesKey: 'opel:astra',
    sourceRecords: 195,
    mappedSourceCodes: 4,
    modelReviewRequired: 191,
    excludedSourceCodes: 0,
    selectableModels: 3,
  })
  expect(manifest.curation.reviewedExactSelectionSeries).toContain('opel:astra')
  expect(manifest.curation.reviewedTechnicalPolicySeries).not.toContain('opel:astra')
})
