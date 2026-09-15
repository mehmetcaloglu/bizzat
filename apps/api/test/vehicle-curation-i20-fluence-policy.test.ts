import { describe, expect, it } from 'vitest'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

const seriesAliases = {
  version: '1',
  entries: [
    { brandKey: 'hyundai', seriesKey: 'hyundai:i20', aliases: ['I20'] },
    { brandKey: 'renault', seriesKey: 'renault:fluence', aliases: ['FLUENCE'] },
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
        { raw: 'HYUNDAI', brandKey: 'hyundai' },
        { raw: 'RENAULT', brandKey: 'renault' },
      ],
    },
    seriesAliases,
    bootstrapModels: { Hyundai: ['i20'], Renault: ['Fluence'] },
    version: 'test',
  })
}

describe('reviewed Hyundai i20 normalization policy', () => {
  it.each([
    ['1.0 T 90 ELITE DCT', ['1.0 T-GDi', 'Elite']],
    ['1.0T 100 STYLE PLUS 7DCT', ['1.0 T-GDi', 'Style Plus']],
    ['FL 1.2 MPI 84 JUMP', ['1.2 MPI', 'Jump']],
    ['1.4 CRDI (90) STYLE', ['1.4 CRDi', 'Style']],
    ['1.4 MPI 100 ELITE 6AT', ['1.4 MPI', 'Elite']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, path) => {
    expect(canonicalModelSelection('hyundai:i20', proposed, `i20 ${proposed}`)?.path).toEqual(path)
  })

  it('does not broaden CVVT engine grammar as a side effect of this batch', () => {
    expect(canonicalModelSelection('hyundai:i20', '1.2 D-CVVT JUMP', 'i20 1.2 D-CVVT JUMP')).toBeNull()
    expect(canonicalModelSelection('hyundai:elantra', '1.6 D-CVVT STYLE', 'ELANTRA 1.6 D-CVVT STYLE')).toBeNull()
  })

  it('preserves an already mapped reviewed i20 source when source gating is enabled', () => {
    const result = generate('HYUNDAI', [['177-1088', 'i20 1.2 MPI JUMP']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '177-1088', vehicleModelKey: 'hyundai:i20:1-2-mpi-jump', method: 'exact-rule' },
    ])
  })

  it('maps a reviewed modern i20 source code', () => {
    const result = generate('HYUNDAI', [['177-1280', 'i20 1.4 MPI 100 ELITE 6AT']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '177-1280', vehicleModelKey: 'hyundai:i20:1-4-mpi-elite', method: 'exact-rule' },
    ])
  })

  it('keeps the same parseable label review-only for an unreviewed source code', () => {
    const result = generate('HYUNDAI', [['177-9999', 'i20 1.4 MPI 100 ELITE 6AT']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })

  it.each([
    ['177-1165', 'i20 ACTIVE 1.0 T-GDI ELITE'],
    ['177-1328', 'i20 N 1.6 T-GDI (204)'],
    ['177-1003', 'i20 TROY 1.2 TEAM'],
    ['177-1287', 'i20 1.0T 48V STYLE PLUS 7DCT'],
  ])('keeps taxonomy-sensitive i20 source %s outside the batch', (sourceKey, typeRaw) => {
    expect(generate('HYUNDAI', [[sourceKey, typeRaw]]).mappings.mappings).toEqual([])
  })
})

describe('reviewed Renault Fluence normalization policy', () => {
  it.each([
    ['ICON 1.5 DCI 110 EDC', ['1.5 dCi', 'Icon']],
    ['TOUCH PLUS 1.5 DCI 90', ['1.5 dCi', 'Touch Plus']],
    ['PRIVILEGE 1.6 16V 110 OV E5', ['1.6', 'Privilege']],
    ['ICON 1.6 DCI 130', ['1.6 dCi', 'Icon']],
    ['EXTREME EDITION 1.6 16V 105 OV E5', ['1.6', 'Extreme Edition']],
  ])('normalizes %s to marketplace engine/trim path', (proposed, path) => {
    expect(canonicalModelSelection('renault:fluence', proposed, `FLUENCE ${proposed}`)?.path).toEqual(path)
  })

  it('maps a reviewed Fluence dCi source code', () => {
    const result = generate('RENAULT', [['122-1098', 'FLUENCE TOUCH 1.5 DCI 110 EDC']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '122-1098', vehicleModelKey: 'renault:fluence:1-5-dci-touch', method: 'exact-rule' },
    ])
  })

  it('maps a reviewed Fluence petrol source code', () => {
    const result = generate('RENAULT', [['122-1095', 'FLUENCE TOUCH 1.6 16V 110']])
    expect(result.mappings.mappings).toEqual([
      { sourceKey: '122-1095', vehicleModelKey: 'renault:fluence:1-6-touch', method: 'exact-rule' },
    ])
  })

  it('keeps the same parseable label review-only for an unreviewed source code', () => {
    const result = generate('RENAULT', [['122-9999', 'FLUENCE TOUCH 1.5 DCI 110 EDC']])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates[0]).toMatchObject({ modelStatus: 'model-review', reviewReason: 'exact-source-review-only' })
  })

  it.each([
    ['122-1066', 'FLUENCE ZE DYNAMIQUE'],
    ['122-1002', 'FLUENCE ZE EXPRESSION'],
    ['122-593', 'FLUENCE BOLD EDITION 1.5 DCI EDC'],
    ['122-1067', 'FLUENCE ELEGANCE 1.5 DCI EDC 110 E5'],
  ])('keeps taxonomy-sensitive Fluence source %s outside the batch', (sourceKey, typeRaw) => {
    expect(generate('RENAULT', [[sourceKey, typeRaw]]).mappings.mappings).toEqual([])
  })
})
