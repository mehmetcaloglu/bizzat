import { describe, expect, it } from 'vitest'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import type { VehicleBrandAliasesFile, VehicleSeriesAliasesFile } from '../src/reference/vehicle/curation/alias.types.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

const brandAliases: VehicleBrandAliasesFile = {
  version: '1',
  aliases: [
    { raw: 'SEAT', brandKey: 'seat' },
    { raw: 'SKODA', brandKey: 'skoda' },
    { raw: 'VOLKSWAGEN', brandKey: 'volkswagen' },
    { raw: 'AUDI', brandKey: 'audi' },
    { raw: 'BMW', brandKey: 'bmw' },
    { raw: 'FIAT', brandKey: 'fiat' },
  ],
}

const seriesAliases: VehicleSeriesAliasesFile = {
  version: '1',
  entries: [
    { brandKey: 'seat', seriesKey: 'seat:ibiza', aliases: ['IBIZA'] },
    { brandKey: 'skoda', seriesKey: 'skoda:octavia', aliases: ['OCTAVIA'] },
    { brandKey: 'volkswagen', seriesKey: 'volkswagen:polo', aliases: ['POLO'] },
    { brandKey: 'audi', seriesKey: 'audi:a3', aliases: ['A3'] },
    { brandKey: 'bmw', seriesKey: 'bmw:3-serisi', aliases: ['3 SERISI'] },
    { brandKey: 'fiat', seriesKey: 'fiat:egea', aliases: ['EGEA'] },
  ],
}

function generate(rows: Array<[string, string, string]>): ReturnType<typeof generateCuratedVehicleCatalog> {
  const snapshot: NormalizedVehicleSourceSnapshot = {
    provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
    records: rows.map(([sourceKey, brandRaw, typeRaw]) => ({
      sourceKey,
      brandRaw,
      typeRaw,
      availableModelYears: [2025],
    })),
  }

  return generateCuratedVehicleCatalog({
    snapshot,
    brandAliases,
    seriesAliases,
    bootstrapModels: {},
    version: 'diagnostic-test',
  })
}

function reason(result: ReturnType<typeof generateCuratedVehicleCatalog>, index = 0): string | null | undefined {
  return (result.candidates[index] as unknown as { reviewReason?: string | null }).reviewReason
}

describe('vehicle curation review diagnostics', () => {
  it('identifies source-code scoped rows before model evaluation', () => {
    const result = generate([
      ['19-9999', 'SEAT', 'IBIZA 1.0 75 S&S STYLE'],
    ])

    expect(result.candidates[0]!.modelStatus).toBe('model-review')
    expect(reason(result)).toBe('exact-source-review-only')
  })

  it('identifies high-volume series that still lack a reviewed normalization policy', () => {
    const result = generate([
      ['101-1', 'SKODA', 'OCTAVIA 1.6 TDI 105 DSG ELEGANCE'],
    ])

    expect(result.candidates[0]!.modelStatus).toBe('model-review')
    expect(reason(result)).toBe('missing-series-policy')
  })

  it('distinguishes unknown trims after a reviewed series policy was applied', () => {
    const result = generate([
      ['117-1', 'VOLKSWAGEN', 'POLO 1.0 TSI 95 DSG MYSTERY'],
    ])

    expect(reason(result)).toBe('unknown-trim')
  })

  it('distinguishes ambiguous Audi body and BMW drivetrain branches', () => {
    const result = generate([
      ['6-1', 'AUDI', 'A3 35 TFSI 150 ADVANCED S TRONIC'],
      ['22-1', 'BMW', '3 SERISI 320D SEDAN XDRIVE COMFORT PLUS'],
    ])

    expect(reason(result, 0)).toBe('ambiguous-body')
    expect(reason(result, 1)).toBe('drivetrain-needs-branch')
  })

  it('distinguishes explicit unsupported shapes from generic unknown trims', () => {
    const result = generate([
      ['100-1', 'FIAT', 'EGEA CROSS URBAN 1.4 FIRE 95'],
    ])

    expect(reason(result)).toBe('unsupported-shape')
  })

  it('aggregates review reasons without changing mapped output', () => {
    const result = generate([
      ['101-1', 'SKODA', 'OCTAVIA 1.6 TDI 105 DSG ELEGANCE'],
      ['117-1', 'VOLKSWAGEN', 'POLO 1.0 TSI 95 DSG MYSTERY'],
      ['117-2', 'VOLKSWAGEN', 'POLO 1.0 TSI 95 DSG LIFE'],
    ])

    const summary = result.summary as unknown as {
      modelReviewRequired: number
      modelReviewByReason?: Record<string, number>
    }

    expect(result.mappings.mappings).toEqual([
      {
        sourceKey: '117-2',
        vehicleModelKey: 'volkswagen:polo:1-0-tsi-life',
        method: 'exact-rule',
      },
    ])
    expect(summary.modelReviewRequired).toBe(2)
    expect(summary.modelReviewByReason).toEqual({
      'missing-series-policy': 1,
      'unknown-trim': 1,
    })
  })
})
