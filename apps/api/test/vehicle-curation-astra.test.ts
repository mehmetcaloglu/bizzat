import { describe, expect, it } from 'vitest'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from '../src/reference/vehicle/curation/alias-validator.js'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'

const reviewedRows = [
  ['111-717', 'HB 1.3 CDTI (95) COSMO', 'ASTRA HB 1.3 CDTI (95) COSMO', ['1.3 CDTI', 'Cosmo']],
  ['111-716', 'HB 1.3 CDTI (95) SPORT', 'ASTRA HB 1.3 CDTI (95) SPORT', ['1.3 CDTI', 'Sport']],
  ['111-715', 'HB 1.3 CDTI (95) ENJOY PLUS', 'ASTRA HB 1.3 CDTI (95) ENJOY PLUS', ['1.3 CDTI', 'Enjoy Plus']],
  ['111-1011', 'HB 1.3 CDTI (90) ENJOY PLUS', 'ASTRA HB 1.3 CDTI (90) ENJOY PLUS', ['1.3 CDTI', 'Enjoy Plus']],
] as const

describe('reviewed Astra marketplace selections', () => {
  it.each(reviewedRows)('maps reviewed TSB source %s to its marketplace path', (_sourceKey, proposed, raw, path) => {
    expect(canonicalModelSelection('opel:astra', proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['SEDAN 1.3 CDTI 95 SPORT', 'ASTRA SEDAN 1.3 CDTI 95 SPORT'],
    ['HB 1.3 DIZEL 95 ENJOY ACTIVE', 'ASTRA HB 1.3 DIZEL 95 ENJOY ACTIVE'],
    ['HB 1.3 DIZEL 95 S&S SPORT', 'ASTRA HB 1.3 DIZEL 95 S&S SPORT'],
    ['HB 1.3 CDTI (95) ENJOY', 'ASTRA HB 1.3 CDTI (95) ENJOY'],
  ])('keeps an unreviewed Astra source variant in review', (proposed, raw) => {
    expect(canonicalModelSelection('opel:astra', proposed, raw)).toBeNull()
  })

  it('generates exactly three reviewed leaves and four source mappings', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
        records: reviewedRows.map(([sourceKey, _proposed, typeRaw]) => ({
          sourceKey,
          brandRaw: 'OPEL',
          typeRaw,
          availableModelYears: [2026],
        })),
      },
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'OPEL', brandKey: 'opel' }],
      }),
      seriesAliases: validateVehicleSeriesAliases({
        version: '1',
        entries: [{ brandKey: 'opel', seriesKey: 'opel:astra', aliases: ['ASTRA'] }],
      }),
      bootstrapModels: { Opel: ['Astra'] },
      version: 'astra-reviewed',
    })

    expect(result.catalog.brands).toEqual([{ key: 'opel', name: 'Opel' }])
    expect(result.catalog.series).toEqual([{ key: 'opel:astra', brandKey: 'opel', name: 'Astra' }])
    expect(result.catalog.models).toEqual([
      {
        key: 'opel:astra:1-3-cdti-cosmo',
        seriesKey: 'opel:astra',
        name: '1.3 CDTI Cosmo',
        selectionPath: [
          { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
          { key: 'opel:astra:1-3-cdti-cosmo', name: 'Cosmo' },
        ],
      },
      {
        key: 'opel:astra:1-3-cdti-enjoy-plus',
        seriesKey: 'opel:astra',
        name: '1.3 CDTI Enjoy Plus',
        selectionPath: [
          { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
          { key: 'opel:astra:1-3-cdti-enjoy-plus', name: 'Enjoy Plus' },
        ],
      },
      {
        key: 'opel:astra:1-3-cdti-sport',
        seriesKey: 'opel:astra',
        name: '1.3 CDTI Sport',
        selectionPath: [
          { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
          { key: 'opel:astra:1-3-cdti-sport', name: 'Sport' },
        ],
      },
    ])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '111-1011', vehicleModelKey: 'opel:astra:1-3-cdti-enjoy-plus', method: 'exact-rule' },
      { sourceKey: '111-715', vehicleModelKey: 'opel:astra:1-3-cdti-enjoy-plus', method: 'exact-rule' },
      { sourceKey: '111-716', vehicleModelKey: 'opel:astra:1-3-cdti-sport', method: 'exact-rule' },
      { sourceKey: '111-717', vehicleModelKey: 'opel:astra:1-3-cdti-cosmo', method: 'exact-rule' },
    ])
    expect(result.summary).toMatchObject({
      sourceRecords: 4,
      exactCandidates: 4,
      mappedSourceCodes: 4,
      canonicalBrands: 1,
      canonicalSeries: 1,
      canonicalModels: 3,
      modelReviewRequired: 0,
    })
  })
})
