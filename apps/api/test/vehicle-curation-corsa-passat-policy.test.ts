import { describe, expect, it } from 'vitest'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

const seriesAliases = {
  version: '1',
  entries: [
    { brandKey: 'opel', seriesKey: 'opel:corsa', aliases: ['CORSA'] },
    { brandKey: 'volkswagen', seriesKey: 'volkswagen:passat', aliases: ['PASSAT'] },
  ],
}

function generate(brandRaw: string, rows: Array<[string, string]>): ReturnType<typeof generateCuratedVehicleCatalog> {
  const snapshot: NormalizedVehicleSourceSnapshot = {
    provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
    records: rows.map(([sourceKey, typeRaw]) => ({
      sourceKey,
      brandRaw,
      typeRaw,
      availableModelYears: [2025],
    })),
  }

  return generateCuratedVehicleCatalog({
    snapshot,
    brandAliases: {
      version: '1',
      aliases: [
        { raw: 'OPEL', brandKey: 'opel' },
        { raw: 'VOLKSWAGEN', brandKey: 'volkswagen' },
      ],
    },
    seriesAliases,
    bootstrapModels: { Opel: ['Corsa'], Volkswagen: ['Passat'] },
    version: 'test',
  })
}

describe('reviewed Corsa normalization policy', () => {
  it.each([
    ['1.2 100 AT8 EDITION', 'CORSA 1.2 100 AT8 EDITION', ['1.2 T', 'Edition']],
    ['1.2 130 AT8 ULTIMATE', 'CORSA 1.2 130 AT8 ULTIMATE', ['1.2 T', 'Ultimate']],
    ['1.2 75 MT5 ESSENTIAL', 'CORSA 1.2 75 MT5 ESSENTIAL', ['1.2', 'Essential']],
    ['5 KAPI ESSENTIA 1.2 70', 'CORSA 5 KAPI ESSENTIA 1.2 70', ['1.2', 'Essentia']],
    ['5 KAPI COLOR EDITION 1.4 90', 'CORSA 5 KAPI COLOR EDITION 1.4 90', ['1.4', 'Color Edition']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, raw, path) => {
    expect(canonicalModelSelection('opel:corsa', proposed, raw)?.path).toEqual(path)
  })

  it('maps an explicitly reviewed turbo source code', () => {
    const result = generate('OPEL', [['111-1385', 'CORSA 1.2 100 AT8 EDITION']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '111-1385', vehicleModelKey: 'opel:corsa:1-2-t-edition', method: 'exact-rule' },
    ])
  })

  it('maps an explicitly reviewed naturally aspirated source code', () => {
    const result = generate('OPEL', [['111-1151', 'CORSA 5 KAPI ESSENTIA 1.2 70']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '111-1151', vehicleModelKey: 'opel:corsa:1-2-essentia', method: 'exact-rule' },
    ])
  })

  it('does not trust the same parseable label from an unreviewed source code', () => {
    const result = generate('OPEL', [['111-9999', 'CORSA 1.2 100 AT8 EDITION']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })

  it.each([
    ['111-1430', 'CORSA-E EDITION 100KW'],
    ['111-9000', 'CORSA VAN 1.3 CDTI'],
  ])('keeps non-passenger or distinct-nameplate source %s out of mappings', (sourceKey, typeRaw) => {
    const result = generate('OPEL', [[sourceKey, typeRaw]])
    expect(result.mappings.mappings).toEqual([])
  })
})

describe('reviewed Passat normalization policy', () => {
  it.each([
    ['1.6 TDI BMT 120 COMFORTLINE DSG', 'PASSAT 1.6 TDI BMT 120 COMFORTLINE DSG', ['1.6 TDI BlueMotion', 'Comfortline']],
    ['2.0 TDI BMT 150 HIGHLINE DSG', 'PASSAT 2.0 TDI BMT 150 HIGHLINE DSG', ['2.0 TDI BlueMotion', 'Highline']],
    ['1.4 TSI BMT 125 TRENDLINE', 'PASSAT 1.4 TSI BMT 125 TRENDLINE', ['1.4 TSI BlueMotion', 'Trendline']],
    ['1.6 TDI 120 DSG ELEGANCE', 'PASSAT 1.6 TDI 120 DSG ELEGANCE', ['1.6 TDI', 'Elegance']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, raw, path) => {
    expect(canonicalModelSelection('volkswagen:passat', proposed, raw)?.path).toEqual(path)
  })

  it('does not misuse BlueMotion as a terminal trim when the source has no trim', () => {
    expect(canonicalModelSelection('volkswagen:passat', '1.6 TDI 105 BLUEMOTION', 'PASSAT 1.6 TDI 105 BLUEMOTION')).toBeNull()
  })

  it('keeps eTSI rows out of plain Passat because marketplace puts them under Passat Variant', () => {
    expect(canonicalModelSelection('volkswagen:passat', '1.5 eTSI 150 DSG ELEGANCE', 'PASSAT 1.5 eTSI 150 DSG ELEGANCE')).toBeNull()
  })

  it('maps an explicitly reviewed BlueMotion source code', () => {
    const result = generate('VOLKSWAGEN', [['153-1157', 'PASSAT 1.6 TDI BMT 120 COMFORTLINE']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '153-1157', vehicleModelKey: 'volkswagen:passat:1-6-tdi-bluemotion-comfortline', method: 'exact-rule' },
    ])
  })

  it('maps an explicitly reviewed plain Passat source code', () => {
    const result = generate('VOLKSWAGEN', [['153-1476', 'PASSAT 1.6 TDI 120 DSG ELEGANCE']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '153-1476', vehicleModelKey: 'volkswagen:passat:1-6-tdi-elegance', method: 'exact-rule' },
    ])
  })

  it('does not trust an unreviewed source code even when its label parses', () => {
    const result = generate('VOLKSWAGEN', [['153-9999', 'PASSAT 1.6 TDI BMT 120 COMFORTLINE']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })

  it.each([
    ['153-1612', 'PASSAT 1.5 eTSI 150 DSG ELEGANCE'],
    ['153-9000', 'PASSAT VARIANT 1.5 eTSI 150 DSG ELEGANCE'],
    ['153-9001', 'PASSAT ALLTRACK 2.0 TDI 4MOTION DSG'],
    ['153-9002', 'PASSAT GTE 1.4 TSI DSG'],
  ])('keeps distinct Passat branch source %s out of mappings', (sourceKey, typeRaw) => {
    const result = generate('VOLKSWAGEN', [[sourceKey, typeRaw]])
    expect(result.mappings.mappings).toEqual([])
  })
})
