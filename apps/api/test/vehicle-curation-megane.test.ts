import { describe, expect, it } from 'vitest'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from '../src/reference/vehicle/curation/alias-validator.js'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'

const reviewedRows = [
  ['122-1161', 'ICON 1.5 DCI EDC 110', 'MEGANE SEDAN ICON 1.5 DCI EDC 110', ['1.5 dCi', 'Icon']],
  ['122-1160', 'ICON 1.5 DCI 110', 'MEGANE SEDAN ICON 1.5 DCI 110', ['1.5 dCi', 'Icon']],
  ['122-1107', 'HB JOY 1.5 DCI 90', 'MEGANE HB JOY 1.5 DCI 90', ['1.5 dCi', 'Joy']],
  ['122-1108', 'HB JOY 1.5 DCI EDC 110', 'MEGANE HB JOY 1.5 DCI EDC 110', ['1.5 dCi', 'Joy']],
  ['122-1088', 'HB GT-LINE 1.5 DCI 110 E5', 'MEGANE HB GT-LINE 1.5 DCI 110 E5', ['1.5 dCi', 'GT Line']],
  ['122-1089', 'HB GT-LINE 1.5 DCI 110 EDC E5', 'MEGANE HB GT-LINE 1.5 DCI 110 EDC E5', ['1.5 dCi', 'GT Line']],
  ['122-1105', 'HB JOY 1.6 16V 110', 'MEGANE HB JOY 1.6 16V 110', ['1.6', 'Joy']],
  ['122-1106', 'HB JOY 1.6 16V 115 CVT', 'MEGANE HB JOY 1.6 16V 115 CVT', ['1.6', 'Joy']],
] as const

describe('reviewed Megane marketplace selections', () => {
  it.each(reviewedRows)('maps reviewed TSB source %s to its marketplace path', (_sourceKey, proposed, raw, path) => {
    expect(canonicalModelSelection('renault:megane', proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['ICON 1.5 DCI EDC 110 FAZ2', 'MEGANE SEDAN ICON 1.5 DCI EDC 110 FAZ2'],
    ['HB JOY 1.6 16V 115', 'MEGANE HB JOY 1.6 16V 115'],
    ['HB MYSTERY 1.5 DCI 110', 'MEGANE HB MYSTERY 1.5 DCI 110'],
  ])('keeps an unreviewed Megane source variant in review', (proposed, raw) => {
    expect(canonicalModelSelection('renault:megane', proposed, raw)).toBeNull()
  })

  it('generates exactly four reviewed leaves and eight source mappings', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
        records: reviewedRows.map(([sourceKey, _proposed, typeRaw]) => ({
          sourceKey,
          brandRaw: 'RENAULT (OYAK)',
          typeRaw,
          availableModelYears: [2026],
        })),
      },
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'RENAULT (OYAK)', brandKey: 'renault' }],
      }),
      seriesAliases: validateVehicleSeriesAliases({
        version: '1',
        entries: [{
          brandKey: 'renault',
          seriesKey: 'renault:megane',
          aliases: ['MEGANE', 'MEGANE SEDAN', 'MEGANE HATCHBACK'],
        }],
      }),
      bootstrapModels: { Renault: ['Megane'] },
      version: 'megane-reviewed',
    })

    expect(result.catalog.brands).toEqual([{ key: 'renault', name: 'Renault' }])
    expect(result.catalog.series).toEqual([{ key: 'renault:megane', brandKey: 'renault', name: 'Megane' }])
    expect(result.catalog.models).toEqual([
      {
        key: 'renault:megane:1-5-dci-gt-line',
        seriesKey: 'renault:megane',
        name: '1.5 dCi GT Line',
        selectionPath: [
          { key: 'renault:megane:1-5-dci', name: '1.5 dCi' },
          { key: 'renault:megane:1-5-dci-gt-line', name: 'GT Line' },
        ],
      },
      {
        key: 'renault:megane:1-5-dci-icon',
        seriesKey: 'renault:megane',
        name: '1.5 dCi Icon',
        selectionPath: [
          { key: 'renault:megane:1-5-dci', name: '1.5 dCi' },
          { key: 'renault:megane:1-5-dci-icon', name: 'Icon' },
        ],
      },
      {
        key: 'renault:megane:1-5-dci-joy',
        seriesKey: 'renault:megane',
        name: '1.5 dCi Joy',
        selectionPath: [
          { key: 'renault:megane:1-5-dci', name: '1.5 dCi' },
          { key: 'renault:megane:1-5-dci-joy', name: 'Joy' },
        ],
      },
      {
        key: 'renault:megane:1-6-joy',
        seriesKey: 'renault:megane',
        name: '1.6 Joy',
        selectionPath: [
          { key: 'renault:megane:1-6', name: '1.6' },
          { key: 'renault:megane:1-6-joy', name: 'Joy' },
        ],
      },
    ])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '122-1088', vehicleModelKey: 'renault:megane:1-5-dci-gt-line', method: 'exact-rule' },
      { sourceKey: '122-1089', vehicleModelKey: 'renault:megane:1-5-dci-gt-line', method: 'exact-rule' },
      { sourceKey: '122-1105', vehicleModelKey: 'renault:megane:1-6-joy', method: 'exact-rule' },
      { sourceKey: '122-1106', vehicleModelKey: 'renault:megane:1-6-joy', method: 'exact-rule' },
      { sourceKey: '122-1107', vehicleModelKey: 'renault:megane:1-5-dci-joy', method: 'exact-rule' },
      { sourceKey: '122-1108', vehicleModelKey: 'renault:megane:1-5-dci-joy', method: 'exact-rule' },
      { sourceKey: '122-1160', vehicleModelKey: 'renault:megane:1-5-dci-icon', method: 'exact-rule' },
      { sourceKey: '122-1161', vehicleModelKey: 'renault:megane:1-5-dci-icon', method: 'exact-rule' },
    ])
    expect(result.summary).toMatchObject({
      sourceRecords: 8,
      exactCandidates: 8,
      mappedSourceCodes: 8,
      canonicalBrands: 1,
      canonicalSeries: 1,
      canonicalModels: 4,
      modelReviewRequired: 0,
    })
  })
})
