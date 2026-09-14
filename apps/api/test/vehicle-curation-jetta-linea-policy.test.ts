import { describe, expect, it } from 'vitest'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

// These cases intentionally separate normalization from exact source-code trust.
const seriesAliases = {
  version: '1',
  entries: [
    { brandKey: 'volkswagen', seriesKey: 'volkswagen:jetta', aliases: ['JETTA'] },
    { brandKey: 'fiat', seriesKey: 'fiat:linea', aliases: ['LINEA'] },
  ],
}

function generate(brandRaw: string, rows: Array<[string, string]>): ReturnType<typeof generateCuratedVehicleCatalog> {
  const snapshot: NormalizedVehicleSourceSnapshot = {
    provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
    records: rows.map(([sourceKey, typeRaw]) => ({ sourceKey, brandRaw, typeRaw, availableModelYears: [2025] })),
  }

  return generateCuratedVehicleCatalog({
    snapshot,
    brandAliases: {
      version: '1',
      aliases: [
        { raw: 'VOLKSWAGEN', brandKey: 'volkswagen' },
        { raw: 'FIAT', brandKey: 'fiat' },
      ],
    },
    seriesAliases,
    bootstrapModels: { Volkswagen: ['Jetta'], Fiat: ['Linea'] },
    version: 'test',
  })
}

describe('reviewed Volkswagen Jetta normalization policy', () => {
  it.each([
    ['1.4 TSI BMT 125 COMFORTLINE DSG', ['1.4 TSI BlueMotion', 'Comfortline']],
    ['1.2 TSI BMT 105 TRENDLINE', ['1.2 TSI BlueMotion', 'Trendline']],
    ['1.4 TSI 160 HIGHLINE DSG', ['1.4 TSI', 'Highline']],
    ['1.6 TDI (105) COMFORTLINE TIPT DSG', ['1.6 TDI', 'Comfortline']],
    ['1.6 PRIMELINE TIPTRONIC', ['1.6', 'Primeline']],
    ['2.0 FSI (150) TRENDLINE TIPTRONIC', ['2.0 FSI', 'Trendline']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, path) => {
    expect(canonicalModelSelection('volkswagen:jetta', proposed, `JETTA ${proposed}`)?.path).toEqual(path)
  })

  it('maps an explicitly reviewed BlueMotion source code', () => {
    const result = generate('VOLKSWAGEN', [['153-1213', 'JETTA 1.4 TSI BMT 125 COMFORTLINE']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '153-1213', vehicleModelKey: 'volkswagen:jetta:1-4-tsi-bluemotion-comfortline', method: 'exact-rule' },
    ])
  })

  it('maps an explicitly reviewed plain TDI source code', () => {
    const result = generate('VOLKSWAGEN', [['153-989', 'JETTA 1.6 TDI (105) COMFORTLINE']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '153-989', vehicleModelKey: 'volkswagen:jetta:1-6-tdi-comfortline', method: 'exact-rule' },
    ])
  })

  it('keeps the same parseable label review-only for an unreviewed source code', () => {
    const result = generate('VOLKSWAGEN', [['153-9999', 'JETTA 1.4 TSI BMT 125 COMFORTLINE']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })

  it.each([
    ['153-1540', 'JETTA R-LINE 1.4 T 8AT'],
    ['153-1547', 'JETTA SE 1.4 TSI 150 TIPTRONIC'],
    ['153-1602', 'JETTA 1.5 TSI (158)'],
  ])('keeps imported or taxonomy-uncertain source %s outside the batch', (sourceKey, typeRaw) => {
    expect(generate('VOLKSWAGEN', [[sourceKey, typeRaw]]).mappings.mappings).toEqual([])
  })
})

describe('reviewed Fiat Linea normalization policy', () => {
  it.each([
    ['ACTUAL 1.4 FIRE 77 E5', ['1.4 Fire', 'Actual']],
    ['EASY 1.4 77', ['1.4 Fire', 'Easy']],
    ['ACTIVE PLUS 1.4 T-JET (120)', ['1.4 Turbo', 'Active Plus']],
    ['1.3 M.JET 95 MOOD', ['1.3 Multijet', 'Mood']],
    ['VIA 1.3 MULTIJET 90', ['1.3 Multijet', 'VIA']],
    ['1.6 MULTIJET (105) DYNAMIC', ['1.6 Multijet', 'Dynamic']],
    ['DYNAMIC PLUS 1.3 MULTIJET 90 DUALO', ['1.3 Multijet', 'Dynamic Plus']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, path) => {
    expect(canonicalModelSelection('fiat:linea', proposed, `LINEA ${proposed}`)?.path).toEqual(path)
  })

  it('maps an explicitly reviewed Multijet source code', () => {
    const result = generate('FIAT', [['100-1041', 'LINEA EASY 1.3 MULTIJET 95']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '100-1041', vehicleModelKey: 'fiat:linea:1-3-multijet-easy', method: 'exact-rule' },
    ])
  })

  it('maps an explicitly reviewed Turbo source code', () => {
    const result = generate('FIAT', [['100-493', 'LINEA ACTIVE PLUS 1.4 T-JET (120)']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '100-493', vehicleModelKey: 'fiat:linea:1-4-turbo-active-plus', method: 'exact-rule' },
    ])
  })

  it('keeps the same parseable label review-only for an unreviewed source code', () => {
    const result = generate('FIAT', [['100-9999', 'LINEA EASY 1.3 MULTIJET 95']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })
})
