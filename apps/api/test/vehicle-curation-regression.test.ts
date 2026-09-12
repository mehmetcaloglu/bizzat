import { describe, expect, it } from 'vitest'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from '../src/reference/vehicle/curation/alias-validator.js'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'

type ReviewedScopeCase = {
  seriesKey: string
  brandRaw: string
  brandKey: string
  seriesAlias: string
  bootstrapBrand: string
  bootstrapModel: string
  reviewedSourceKey: string
  unreviewedSourceKey: string
  typeRaw: string
  expectedModelKey: string
}

const reviewedScopeCases: ReviewedScopeCase[] = [
  {
    seriesKey: 'seat:ibiza',
    brandRaw: 'SEAT',
    brandKey: 'seat',
    seriesAlias: 'IBIZA',
    bootstrapBrand: 'Seat',
    bootstrapModel: 'Ibiza',
    reviewedSourceKey: '19-1035',
    unreviewedSourceKey: '19-9999',
    typeRaw: 'IBIZA 1.4 (85) REFERENCE',
    expectedModelKey: 'seat:ibiza:1-4-reference',
  },
  {
    seriesKey: 'renault:megane',
    brandRaw: 'RENAULT (OYAK)',
    brandKey: 'renault',
    seriesAlias: 'MEGANE',
    bootstrapBrand: 'Renault',
    bootstrapModel: 'Megane',
    reviewedSourceKey: '122-1088',
    unreviewedSourceKey: '123-2052',
    typeRaw: 'MEGANE HB GT-LINE 1.5 DCI 110 E5',
    expectedModelKey: 'renault:megane:1-5-dci-gt-line',
  },
  {
    seriesKey: 'ford:focus',
    brandRaw: 'FORD',
    brandKey: 'ford',
    seriesAlias: 'FOCUS',
    bootstrapBrand: 'Ford',
    bootstrapModel: 'Focus',
    reviewedSourceKey: '53-2123',
    unreviewedSourceKey: '53-9999',
    typeRaw: 'FOCUS III MCA STYLE 1.5 TDCI 120 4K PWS',
    expectedModelKey: 'ford:focus:1-5-tdci-style',
  },
  {
    seriesKey: 'opel:astra',
    brandRaw: 'OPEL',
    brandKey: 'opel',
    seriesAlias: 'ASTRA',
    bootstrapBrand: 'Opel',
    bootstrapModel: 'Astra',
    reviewedSourceKey: '111-717',
    unreviewedSourceKey: '111-9999',
    typeRaw: 'ASTRA HB 1.3 CDTI (95) COSMO',
    expectedModelKey: 'opel:astra:1-3-cdti-cosmo',
  },
]

function generateScopedCase(input: ReviewedScopeCase) {
  return generateCuratedVehicleCatalog({
    snapshot: {
      provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
      records: [input.reviewedSourceKey, input.unreviewedSourceKey].map((sourceKey) => ({
        sourceKey,
        brandRaw: input.brandRaw,
        typeRaw: input.typeRaw,
        availableModelYears: [2026],
      })),
    },
    brandAliases: validateVehicleBrandAliases({
      version: '1',
      aliases: [{ raw: input.brandRaw, brandKey: input.brandKey }],
    }),
    seriesAliases: validateVehicleSeriesAliases({
      version: '1',
      entries: [{
        brandKey: input.brandKey,
        seriesKey: input.seriesKey,
        aliases: [input.seriesAlias],
      }],
    }),
    bootstrapModels: { [input.bootstrapBrand]: [input.bootstrapModel] },
    version: 'scope-regression',
  })
}

describe('reviewed vehicle curation regressions', () => {
  it.each(reviewedScopeCases)(
    'maps only reviewed source codes for $seriesKey even when an unreviewed code has the same label',
    (input) => {
      const result = generateScopedCase(input)

      expect(result.mappings.mappings).toEqual([
        {
          sourceKey: input.reviewedSourceKey,
          vehicleModelKey: input.expectedModelKey,
          method: 'exact-rule',
        },
      ])
      expect(result.candidates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceKey: input.unreviewedSourceKey,
          modelStatus: 'model-review',
          vehicleModelKey: null,
        }),
      ]))
      expect(result.summary).toMatchObject({
        sourceRecords: 2,
        exactCandidates: 1,
        mappedSourceCodes: 1,
        modelReviewRequired: 1,
      })
    },
  )

  it('preserves a reviewed baseline series display name during regeneration', () => {
    const args: Parameters<typeof generateCuratedVehicleCatalog>[0] = {
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
        records: [{
          sourceKey: '34-1',
          brandRaw: 'HONDA',
          typeRaw: 'CIVIC 1.6 EXECUTIVE',
          availableModelYears: [2026],
        }],
      },
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'HONDA', brandKey: 'honda' }],
      }),
      seriesAliases: validateVehicleSeriesAliases({
        version: '1',
        entries: [{ brandKey: 'honda', seriesKey: 'honda:civic', aliases: ['CIVIC'] }],
      }),
      bootstrapModels: { Honda: ['Civic'] },
      version: 'baseline-name-regression',
    }

    const baseline = generateCuratedVehicleCatalog(args)
    baseline.catalog.series[0]!.name = 'Civic Reviewed Display'

    const regenerated = generateCuratedVehicleCatalog({ ...args, baseline })

    expect(regenerated.catalog.series).toEqual([
      { key: 'honda:civic', brandKey: 'honda', name: 'Civic Reviewed Display' },
    ])
  })
})
