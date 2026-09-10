import { describe, expect, it } from 'vitest'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from '../src/reference/vehicle/curation/alias-validator.js'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'

const reviewedRows = [
  ['53-2123', 'III MCA STYLE 1.5 TDCI 120 4K PWS', 'FOCUS III MCA STYLE 1.5 TDCI 120 4K PWS', ['1.5 TDCi', 'Style']],
  ['53-2126', 'III MCA TITANIUM 1.5 TDCI 120 4K PWS', 'FOCUS III MCA TITANIUM 1.5 TDCI 120 4K PWS', ['1.5 TDCi', 'Titanium']],
  ['53-2120', 'III MCA TREND X 1.5 TDCI 120 4K PWS', 'FOCUS III MCA TREND X 1.5 TDCI 120 4K PWS', ['1.5 TDCi', 'Trend X']],
  ['53-2196', 'ST LINE 1.5 TDCI 120 5K POWERSHIFT', 'FOCUS ST LINE 1.5 TDCI 120 5K POWERSHIFT', ['1.5 TDCi', 'ST Line']],
  ['53-2251', 'TREND X 1.5 TDCI 120 4 KAPI E6.2', 'FOCUS TREND X 1.5 TDCI 120 4 KAPI E6.2', ['1.5 TDCi', 'Trend X']],
  ['53-2254', 'TREND X 1.5 TDCI 120 5 KAPI 8S AT E6.2', 'FOCUS TREND X 1.5 TDCI 120 5 KAPI 8S AT E6.2', ['1.5 TDCi', 'Trend X']],
] as const

describe('reviewed Focus marketplace selections', () => {
  it.each(reviewedRows)('maps reviewed TSB source %s to its marketplace path', (_sourceKey, proposed, raw, path) => {
    expect(canonicalModelSelection('ford:focus', proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['III MCA STYLE 1.5 TDCI 120 5K PWS', 'FOCUS III MCA STYLE 1.5 TDCI 120 5K PWS'],
    ['III MCA TITANIUM 1.5 TDCI 120 5K PWS', 'FOCUS III MCA TITANIUM 1.5 TDCI 120 5K PWS'],
    ['1.5 TDCI 120 SW TREND X E6', 'FOCUS 1.5 TDCI 120 SW TREND X E6'],
    ['MYSTERY 1.5 TDCI 120', 'FOCUS MYSTERY 1.5 TDCI 120'],
  ])('keeps an unreviewed Focus source variant in review', (proposed, raw) => {
    expect(canonicalModelSelection('ford:focus', proposed, raw)).toBeNull()
  })

  it('generates exactly four reviewed leaves and six source mappings', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
        records: reviewedRows.map(([sourceKey, _proposed, typeRaw]) => ({
          sourceKey,
          brandRaw: 'FORD',
          typeRaw,
          availableModelYears: [2026],
        })),
      },
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'FORD', brandKey: 'ford' }],
      }),
      seriesAliases: validateVehicleSeriesAliases({
        version: '1',
        entries: [{ brandKey: 'ford', seriesKey: 'ford:focus', aliases: ['FOCUS'] }],
      }),
      bootstrapModels: { Ford: ['Focus'] },
      version: 'focus-reviewed',
    })

    expect(result.catalog.brands).toEqual([{ key: 'ford', name: 'Ford' }])
    expect(result.catalog.series).toEqual([{ key: 'ford:focus', brandKey: 'ford', name: 'Focus' }])
    expect(result.catalog.models).toEqual([
      {
        key: 'ford:focus:1-5-tdci-st-line',
        seriesKey: 'ford:focus',
        name: '1.5 TDCi ST Line',
        selectionPath: [
          { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
          { key: 'ford:focus:1-5-tdci-st-line', name: 'ST Line' },
        ],
      },
      {
        key: 'ford:focus:1-5-tdci-style',
        seriesKey: 'ford:focus',
        name: '1.5 TDCi Style',
        selectionPath: [
          { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
          { key: 'ford:focus:1-5-tdci-style', name: 'Style' },
        ],
      },
      {
        key: 'ford:focus:1-5-tdci-titanium',
        seriesKey: 'ford:focus',
        name: '1.5 TDCi Titanium',
        selectionPath: [
          { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
          { key: 'ford:focus:1-5-tdci-titanium', name: 'Titanium' },
        ],
      },
      {
        key: 'ford:focus:1-5-tdci-trend-x',
        seriesKey: 'ford:focus',
        name: '1.5 TDCi Trend X',
        selectionPath: [
          { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
          { key: 'ford:focus:1-5-tdci-trend-x', name: 'Trend X' },
        ],
      },
    ])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '53-2120', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
      { sourceKey: '53-2123', vehicleModelKey: 'ford:focus:1-5-tdci-style', method: 'exact-rule' },
      { sourceKey: '53-2126', vehicleModelKey: 'ford:focus:1-5-tdci-titanium', method: 'exact-rule' },
      { sourceKey: '53-2196', vehicleModelKey: 'ford:focus:1-5-tdci-st-line', method: 'exact-rule' },
      { sourceKey: '53-2251', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
      { sourceKey: '53-2254', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
    ])
    expect(result.summary).toMatchObject({
      sourceRecords: 6,
      exactCandidates: 6,
      mappedSourceCodes: 6,
      canonicalBrands: 1,
      canonicalSeries: 1,
      canonicalModels: 4,
      modelReviewRequired: 0,
    })
  })
})
