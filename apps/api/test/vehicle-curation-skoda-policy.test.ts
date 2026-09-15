import { describe, expect, it } from 'vitest'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import { diagnoseVehicleModelReview } from '../src/reference/vehicle/curation/review-diagnostics.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

const seriesAliases = {
  version: '1',
  entries: [
    { brandKey: 'skoda', seriesKey: 'skoda:octavia', aliases: ['OCTAVIA'] },
    { brandKey: 'skoda', seriesKey: 'skoda:superb', aliases: ['SUPERB'] },
    { brandKey: 'skoda', seriesKey: 'skoda:fabia', aliases: ['FABIA'] },
    { brandKey: 'skoda', seriesKey: 'skoda:rapid', aliases: ['RAPID'] },
  ],
}

function generate(rows: Array<[string, string]>): ReturnType<typeof generateCuratedVehicleCatalog> {
  const snapshot: NormalizedVehicleSourceSnapshot = {
    provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
    records: rows.map(([sourceKey, typeRaw]) => ({
      sourceKey,
      brandRaw: 'SKODA',
      typeRaw,
      availableModelYears: [2025],
    })),
  }
  return generateCuratedVehicleCatalog({
    snapshot,
    brandAliases: { version: '1', aliases: [{ raw: 'SKODA', brandKey: 'skoda' }] },
    seriesAliases,
    bootstrapModels: { Skoda: ['Octavia', 'Superb', 'Fabia', 'Rapid'] },
    version: 'test',
  })
}

describe('reviewed Skoda normalization policy batch', () => {
  it.each([
    ['skoda:octavia', 'AMBIENTE 1.4 TSI 122', 'OCTAVIA AMBIENTE 1.4 TSI (122)', ['1.4 TSI', 'Ambiente']],
    ['skoda:superb', 'COMFORT 1.4 TSI 125', 'SUPERB COMFORT 1.4 TSI (125)', ['1.4 TSI', 'Comfort']],
    ['skoda:fabia', '1.0 TSI 95 DSG PREMIUM', 'FABIA 1.0 TSI 95 DSG PREMIUM', ['1.0 TSI', 'Premium']],
    ['skoda:rapid', 'AMBITION 1.2 TSI 105', 'RAPID AMBITION 1.2 TSI 105', ['1.2 TSI', 'Ambition']],
  ])('normalizes marketplace-evidenced conventional row for %s', (series, proposed, raw, path) => {
    expect(canonicalModelSelection(series, proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['133-378', 'OCTAVIA AMBIENTE 1.4 TSI (122)', 'skoda:octavia:1-4-tsi-ambiente'],
    ['133-365', 'SUPERB COMFORT 1.4 TSI (125)', 'skoda:superb:1-4-tsi-comfort'],
    ['133-1253', 'FABIA 1.0 TSI 95 DSG PREMIUM', 'skoda:fabia:1-0-tsi-premium'],
    ['133-1040', 'RAPID AMBITION 1.2 TSI 105', 'skoda:rapid:1-2-tsi-ambition'],
  ])('allows reviewed source %s to become selectable', (sourceKey, typeRaw, targetKey) => {
    const result = generate([[sourceKey, typeRaw]])
    expect(result.mappings.mappings).toEqual([
      { sourceKey, vehicleModelKey: targetKey, method: 'exact-rule' },
    ])
  })

  it.each([
    ['skoda:octavia', 'COMBI 1.6 TDI CR 110 GREEN TEC STYLE', 'OCTAVIA COMBI 1.6 TDI CR 110 GREEN TEC STYLE'],
    ['skoda:octavia', '1.6 TDI CR 110 GREEN TEC 4X4 STYLE', 'OCTAVIA 1.6 TDI CR 110 GREEN TEC 4X4 STYLE'],
    ['skoda:superb', 'COMBI 1.6 TDI CR 120 DSG PRESTIGE', 'SUPERB COMBI 1.6 TDI CR 120 DSG PRESTIGE'],
    ['skoda:superb', '2.0 TSI 280 4X4 DSG PRESTIGE', 'SUPERB 2.0 TSI 280 4X4 DSG PRESTIGE'],
    ['skoda:fabia', 'COMBI 1.2 TSI 110 DSG STYLE', 'FABIA COMBI 1.2 TSI 110 DSG STYLE'],
    ['skoda:rapid', 'SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION', 'RAPID SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION'],
    ['skoda:octavia', '1.5 TSI ACT E-TEC 150 DSG PRESTIGE', 'OCTAVIA 1.5 TSI ACT e-TEC 150 DSG PRESTIGE'],
    ['skoda:superb', '1.5 TSI MHEV 150 DSG PRESTIGE FL', 'SUPERB 1.5 TSI MHEV 150 DSG PRESTIGE FL'],
  ])('keeps branch or technology-bearing row in review for %s', (series, proposed, raw) => {
    expect(canonicalModelSelection(series, proposed, raw)).toBeNull()
  })

  it.each([
    ['133-1215', 'RAPID 1.0 TSI 110 DSG STYLE'],
    ['133-337', 'FABIA CLASSIC 1.2 (70) PLUS'],
    ['133-343', 'FABIA CLASSIC 1.4 TDI (70) PLUS'],
    ['133-1020', 'OCTAVIA AMBITION 1.6 102'],
    ['133-1022', 'OCTAVIA AMBITION 1.4 TSI 122'],
    ['133-377', 'OCTAVIA CLASSIC 1.4 TSI (122)'],
    ['133-1037', 'RAPID ACTIVE 1.2 75'],
    ['133-1039', 'RAPID AMBITION 1.2 75'],
    ['133-1080', 'RAPID ELEGANCE 1.2 TSI 105'],
    ['133-1041', 'RAPID AMBITION 1.4 TSI 122 DSG TIPTRONIC'],
    ['133-373', 'SUPERB ELEGANCE 1.8 TSI (160) TIPTRONIC'],
    ['133-1269', 'SUPERB 2.0 TDI 150 DSG AMBITION'],
  ])('keeps non-evidenced source %s outside selectable mappings', (sourceKey, typeRaw) => {
    const result = generate([[sourceKey, typeRaw]])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({
      sourceKey,
      modelStatus: 'model-review',
      reviewReason: 'exact-source-review-only',
    })
  })

  it.each([
    ['skoda:octavia', 'COMBI 1.6 TDI CR 110 GREEN TEC STYLE', 'OCTAVIA COMBI 1.6 TDI CR 110 GREEN TEC STYLE'],
    ['skoda:superb', '2.0 TSI 280 4X4 DSG PRESTIGE', 'SUPERB 2.0 TSI 280 4X4 DSG PRESTIGE'],
    ['skoda:fabia', 'COMBI 1.2 TSI 110 DSG STYLE', 'FABIA COMBI 1.2 TSI 110 DSG STYLE'],
    ['skoda:rapid', 'SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION', 'RAPID SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION'],
  ])('reports unresolved reviewed-policy rows as unknown-trim for %s', (series, proposed, raw) => {
    expect(diagnoseVehicleModelReview(series, proposed, raw)).toBe('unknown-trim')
  })
})
