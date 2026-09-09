import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateVehicleCatalog } from '../src/reference/vehicle/catalog-validator.js'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import {
  VehicleAliasValidationError,
  validateVehicleBrandAliases,
  validateVehicleSeriesAliases,
} from '../src/reference/vehicle/curation/alias-validator.js'
import { generateCuratedVehicleCatalog } from '../src/reference/vehicle/curation/catalog-generator.js'
import { generateVehicleCurationCandidates } from '../src/reference/vehicle/curation/candidate-generator.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

const committedSeriesAliasesPath = new URL(
  '../../../data/reference/vehicles/series-aliases.json',
  import.meta.url,
)

function brandAliasesInput(): unknown {
  return {
    version: ' 2026-09-08.1 ',
    aliases: [
      { raw: ' RENAULT (OYAK) ', brandKey: ' renault ' },
      { raw: ' FIAT ', brandKey: ' fiat ' },
      { raw: ' VOLKSWAGEN ', brandKey: ' volkswagen ' },
    ],
  }
}

function seriesAliasesInput(): unknown {
  return {
    version: ' 2026-09-08.1 ',
    entries: [
      { brandKey: 'renault', seriesKey: 'renault:clio', aliases: [' CLIO '] },
      { brandKey: 'fiat', seriesKey: 'fiat:egea', aliases: [' EGEA ', ' EGEA CROSS '] },
      { brandKey: 'volkswagen', seriesKey: 'volkswagen:california', aliases: [' CALIFORNIA '] },
      {
        brandKey: 'volkswagen',
        seriesKey: 'volkswagen:grand-california',
        aliases: [' GRAND CALIFORNIA '],
      },
    ],
  }
}

function records(): NormalizedVehicleSourceSnapshot['records'] {
  return [
    {
      sourceKey: '1-1',
      brandRaw: 'RENAULT (OYAK)',
      typeRaw: 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90',
      availableModelYears: [2024],
    },
    {
      sourceKey: '2-1',
      brandRaw: 'FIAT',
      typeRaw: 'EGEA CROSS 1.5 T4 HYBRID',
      availableModelYears: [2024],
    },
    {
      sourceKey: '3-1',
      brandRaw: 'VOLKSWAGEN',
      typeRaw: 'GRAND CALIFORNIA 600 2.0 TDI',
      availableModelYears: [2024],
    },
    {
      sourceKey: '4-1',
      brandRaw: 'UNKNOWN',
      typeRaw: 'MODEL X 1.0',
      availableModelYears: [2024],
    },
    {
      sourceKey: '5-1',
      brandRaw: 'FIAT',
      typeRaw: 'PANDA 1.0 HYBRID',
      availableModelYears: [2024],
    },
  ]
}

describe('vehicle curation alias validation', () => {
  it('accepts unknown input and trims reviewed alias fields', () => {
    expect(validateVehicleBrandAliases(brandAliasesInput())).toEqual({
      version: '2026-09-08.1',
      aliases: [
        { raw: 'RENAULT (OYAK)', brandKey: 'renault' },
        { raw: 'FIAT', brandKey: 'fiat' },
        { raw: 'VOLKSWAGEN', brandKey: 'volkswagen' },
      ],
    })

    expect(validateVehicleSeriesAliases(seriesAliasesInput())).toEqual({
      version: '2026-09-08.1',
      entries: [
        { brandKey: 'renault', seriesKey: 'renault:clio', aliases: ['CLIO'] },
        { brandKey: 'fiat', seriesKey: 'fiat:egea', aliases: ['EGEA', 'EGEA CROSS'] },
        { brandKey: 'volkswagen', seriesKey: 'volkswagen:california', aliases: ['CALIFORNIA'] },
        {
          brandKey: 'volkswagen',
          seriesKey: 'volkswagen:grand-california',
          aliases: ['GRAND CALIFORNIA'],
        },
      ],
    })
  })

  it('rejects malformed and blank alias files', () => {
    expect(() => validateVehicleBrandAliases(null)).toThrow(VehicleAliasValidationError)
    expect(() => validateVehicleSeriesAliases([])).toThrow(VehicleAliasValidationError)

    const blankVersion = brandAliasesInput() as { version: string }
    blankVersion.version = '   '
    expect(() => validateVehicleBrandAliases(blankVersion)).toThrow(VehicleAliasValidationError)

    const blankBrand = brandAliasesInput() as { aliases: Array<Record<string, unknown>> }
    blankBrand.aliases[0]!.brandKey = ' '
    expect(() => validateVehicleBrandAliases(blankBrand)).toThrow(VehicleAliasValidationError)

    const blankSeriesAlias = seriesAliasesInput() as {
      entries: Array<{ aliases: string[] }>
    }
    blankSeriesAlias.entries[0]!.aliases = ['  ']
    expect(() => validateVehicleSeriesAliases(blankSeriesAlias)).toThrow(VehicleAliasValidationError)
  })

  it('rejects duplicate normalized brand aliases', () => {
    const value = brandAliasesInput() as { aliases: Array<Record<string, unknown>> }
    value.aliases.push({ raw: ' renault   (oyak) ', brandKey: 'other-brand' })
    expect(() => validateVehicleBrandAliases(value)).toThrow(VehicleAliasValidationError)
  })

  it('rejects a normalized series alias pointing to multiple series within one brand', () => {
    const value = seriesAliasesInput() as {
      entries: Array<{ brandKey: string; seriesKey: string; aliases: string[] }>
    }
    value.entries.push({
      brandKey: 'fiat',
      seriesKey: 'fiat:other',
      aliases: [' egea   cross '],
    })
    expect(() => validateVehicleSeriesAliases(value)).toThrow(VehicleAliasValidationError)
  })
})

describe('vehicle curation candidate generation', () => {
  it('resolves exact reviewed brands and longest token-boundary series aliases', () => {
    const candidates = generateVehicleCurationCandidates({
      records: records(),
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
    })

    expect(candidates).toEqual([
      {
        sourceKey: '1-1',
        brandRaw: 'RENAULT (OYAK)',
        typeRaw: 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90',
        brandKeyCandidate: 'renault',
        seriesKeyCandidate: 'renault:clio',
        proposedModelLabel: 'EVOLUTION 1.0 TCE X-TRONIC 90',
        status: 'exact-series',
      },
      {
        sourceKey: '2-1',
        brandRaw: 'FIAT',
        typeRaw: 'EGEA CROSS 1.5 T4 HYBRID',
        brandKeyCandidate: 'fiat',
        seriesKeyCandidate: 'fiat:egea',
        proposedModelLabel: '1.5 T4 HYBRID',
        status: 'exact-series',
      },
      {
        sourceKey: '3-1',
        brandRaw: 'VOLKSWAGEN',
        typeRaw: 'GRAND CALIFORNIA 600 2.0 TDI',
        brandKeyCandidate: 'volkswagen',
        seriesKeyCandidate: 'volkswagen:grand-california',
        proposedModelLabel: '600 2.0 TDI',
        status: 'exact-series',
      },
      {
        sourceKey: '4-1',
        brandRaw: 'UNKNOWN',
        typeRaw: 'MODEL X 1.0',
        brandKeyCandidate: null,
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'unknown-brand',
      },
      {
        sourceKey: '5-1',
        brandRaw: 'FIAT',
        typeRaw: 'PANDA 1.0 HYBRID',
        brandKeyCandidate: 'fiat',
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'no-series',
      },
    ])
  })

  it('matches token boundaries instead of arbitrary substrings', () => {
    const result = generateVehicleCurationCandidates({
      records: [{
        sourceKey: 'x',
        brandRaw: 'FIAT',
        typeRaw: 'MEGEA TEST',
        availableModelYears: [2024],
      }],
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'FIAT', brandKey: 'fiat' }],
      }),
      seriesAliases: validateVehicleSeriesAliases({
        version: '1',
        entries: [{ brandKey: 'fiat', seriesKey: 'fiat:egea', aliases: ['EGEA'] }],
      }),
    })
    expect(result[0]!.status).toBe('no-series')
  })

  it('fails closed when equally specific aliases point to different series', () => {
    const result = generateVehicleCurationCandidates({
      records: [{
        sourceKey: 'x',
        brandRaw: 'TEST BRAND',
        typeRaw: 'ALPHA SPORT 1.0',
        availableModelYears: [2024],
      }],
      brandAliases: validateVehicleBrandAliases({
        version: '1',
        aliases: [{ raw: 'TEST BRAND', brandKey: 'test' }],
      }),
      seriesAliases: {
        version: '1',
        entries: [
          { brandKey: 'test', seriesKey: 'test:one', aliases: ['ALPHA SPORT'] },
          { brandKey: 'test', seriesKey: 'test:two', aliases: ['ALPHA SPORT'] },
        ],
      },
    })

    expect(result[0]).toMatchObject({
      status: 'ambiguous-series',
      brandKeyCandidate: 'test',
      seriesKeyCandidate: null,
      proposedModelLabel: null,
    })
  })
})

describe('vehicle curation catalog generation', () => {
  it.each([
    ['RENAULT (OYAK)', 'renault', 'renault:clio', 'CLIO', 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90', '1.0 TCe Evolution'],
    ['RENAULT (OYAK)', 'renault', 'renault:clio', 'CLIO', 'CLIO JOY 1.0 TCE 90 FAZ1', '1.0 TCe Joy'],
    ['VOLKSWAGEN', 'volkswagen', 'volkswagen:polo', 'POLO', 'POLO 1.0 TSI 95 DSG LIFE', '1.0 TSI Life'],
    ['FIAT', 'fiat', 'fiat:egea', 'EGEA', 'EGEA EASY 1.4 FIRE 95 E6D', '1.4 Fire Easy'],
    ['PEUGEOT', 'peugeot', 'peugeot:308', '308', '308 5 KAPI ACTIVE 1.6 E-HDI (112) AUTO6R', '1.6 e-HDi Active'],
    ['PEUGEOT', 'peugeot', 'peugeot:308', '308', '308 ALLURE 1.2 PURETECH 130 EAT8 S&S', '1.2 PureTech Allure'],
    ['TOYOTA', 'toyota', 'toyota:corolla', 'COROLLA', 'COROLLA 1.5 FLAME X-PACK MULTIDRIVE S FL', '1.5 Flame X-Pack'],
    ['BMW', 'bmw', 'bmw:3-serisi', '320D', '320d SEDAN COMFORT PLUS', '320d Comfort Plus'],
    ['BMW', 'bmw', 'bmw:3-serisi', '320I', '320i SEDAN (184)', '320i Standart'],
    ['MERCEDES', 'mercedes-benz', 'mercedes-benz:c-serisi', 'C', 'C 180 1.6 AMG 7G-TRONIC', 'C 180 AMG'],
    ['AUDI', 'audi', 'audi:a3', 'A3', 'A3 SPORTBACK 35 TFSI S TRONIC ADVANCED', 'A3 Sportback 35 TFSI Advanced'],
    ['AUDI', 'audi', 'audi:a4', 'A4', 'A4 AVANT 2.0 TDI 177 MULTITRONIC PI DESIGN', 'A4 Avant 2.0 TDI Design'],
  ])('consolidates %s source type %s/%s/%s/%s to %s', (raw, brandKey, seriesKey, alias, typeRaw, name) => {
    const result = generateCuratedVehicleCatalog({
      snapshot: { provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' }, records: [
        { sourceKey: 'example', brandRaw: raw, typeRaw, availableModelYears: [2025] },
      ] },
      brandAliases: { version: '1', aliases: [{ raw, brandKey }] },
      seriesAliases: { version: '1', entries: [{ brandKey, seriesKey, aliases: [alias] }] },
      bootstrapModels: {}, version: '1',
    })
    expect(result.catalog.models.map((model) => model.name)).toEqual([name])
    expect(result.mappings.mappings).toHaveLength(1)
  })

  it('maps technical variants together while preserving different engines and trims', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: { provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' }, records: [
        'CLIO EVOLUTION 1.0 TCE 90', 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90',
        'CLIO JOY 1.0 TCE 90', 'CLIO JOY 1.5 DCI 90',
      ].map((typeRaw, i) => ({ sourceKey: String(i), brandRaw: 'RENAULT (OYAK)', typeRaw, availableModelYears: [2025] })) },
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
      bootstrapModels: {}, version: '1',
    })
    expect(result.catalog.models.map((model) => model.name)).toEqual(['1.0 TCe Evolution', '1.0 TCe Joy', '1.5 dCi Joy'])
    expect(result.mappings.mappings[0]!.vehicleModelKey).toBe(result.mappings.mappings[1]!.vehicleModelKey)
    expect(result.catalog.models[0]).toMatchObject({
      selectionPath: [{ key: 'renault:clio:1-0-tce', name: '1.0 TCe' }, { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution' }],
    })
  })

  it('preserves marketplace group distinctions for BMW ED and Clio estate branches', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: { provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' }, records: [
        ['BMW', '320i SEDAN 1.6 170 SPORT LINE'],
        ['BMW', '320i ED SEDAN 1.6 170 SPORT LINE'],
        ['BMW', '320d TOURING SPORT LINE'],
        ['RENAULT (OYAK)', 'CLIO SPORT TOURER JOY 0.9 TCE 90'],
        ['RENAULT (OYAK)', 'CLIO JOY 0.9 TCE 90'],
      ].map(([brandRaw, typeRaw], i) => ({ sourceKey: String(i), brandRaw: brandRaw!, typeRaw: typeRaw!, availableModelYears: [2025] })) },
      brandAliases: { version: '1', aliases: [{ raw: 'BMW', brandKey: 'bmw' }, { raw: 'RENAULT (OYAK)', brandKey: 'renault' }] },
      seriesAliases: { version: '1', entries: [
        { brandKey: 'bmw', seriesKey: 'bmw:3-serisi', aliases: ['320I', '320D'] },
        { brandKey: 'renault', seriesKey: 'renault:clio', aliases: ['CLIO'] },
      ] }, bootstrapModels: {}, version: '1',
    })
    expect(result.catalog.models.map((model) => model.name)).toEqual([
      '320d Touring Sport Line', '320i ED Sport Line', '320i Sport Line',
      '0.9 TCe Joy', '0.9 TCe Sport Tourer Joy',
    ])
    expect(new Set(result.catalog.models.map((model) => model.selectionPath?.[0]?.key)).size).toBe(5)
  })

  const snapshot: NormalizedVehicleSourceSnapshot = {
    provider: {
      code: 'tsb-kasko',
      sourceName: 'TSB',
      version: '2026-08',
    },
    records: [
      {
        sourceKey: '100-1',
        brandRaw: 'FIAT',
        typeRaw: 'EGEA EASY 1.4 FIRE 95',
        availableModelYears: [2025],
      },
      {
        sourceKey: '122-1',
        brandRaw: 'RENAULT (OYAK)',
        typeRaw: 'CLIO EVOLUTION 1.0 TCE 90',
        availableModelYears: [2025],
      },
      {
        sourceKey: '999-1',
        brandRaw: 'UNKNOWN',
        typeRaw: 'MODEL X',
        availableModelYears: [2025],
      },
    ],
  }

  it('emits deterministic canonical catalog and exact-rule mappings', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot,
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
      bootstrapModels: {
        Fiat: ['Egea'],
        Renault: ['Clio'],
      },
      version: '2026-09-08.1',
    })

    expect(result.catalog).toEqual({
      version: '2026-09-08.1',
      brands: [
        { key: 'fiat', name: 'Fiat' },
        { key: 'renault', name: 'Renault' },
      ],
      series: [
        { key: 'fiat:egea', brandKey: 'fiat', name: 'Egea' },
        { key: 'renault:clio', brandKey: 'renault', name: 'Clio' },
      ],
      models: [
        { key: 'fiat:egea:1-4-fire-easy', seriesKey: 'fiat:egea', name: '1.4 Fire Easy', selectionPath: [{ key: 'fiat:egea:1-4-fire', name: '1.4 Fire' }, { key: 'fiat:egea:1-4-fire-easy', name: 'Easy' }] },
        {
          key: 'renault:clio:1-0-tce-evolution',
          seriesKey: 'renault:clio',
          name: '1.0 TCe Evolution',
          selectionPath: [{ key: 'renault:clio:1-0-tce', name: '1.0 TCe' }, { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution' }],
        },
      ],
    })
    expect(result.mappings).toEqual({
      version: '2026-09-08.1',
      mappings: [
        { sourceKey: '100-1', vehicleModelKey: 'fiat:egea:1-4-fire-easy', method: 'exact-rule' },
        {
          sourceKey: '122-1',
          vehicleModelKey: 'renault:clio:1-0-tce-evolution',
          method: 'exact-rule',
        },
      ],
    })
    expect(result.summary).toMatchObject({
      sourceRecords: 3,
      mappedSourceCodes: 2,
      canonicalBrands: 2,
      canonicalSeries: 2,
      canonicalModels: 2,
      slugCollisionsExcluded: 0,
    })
  })

  it('keeps unreviewed source labels outside the selectable catalog', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: {
        ...snapshot,
        records: [
          {
            sourceKey: '100-2',
            brandRaw: 'FIAT',
            typeRaw: 'EGEA 1.4 FIRE A+B',
            availableModelYears: [2025],
          },
          {
            sourceKey: '100-3',
            brandRaw: 'FIAT',
            typeRaw: 'EGEA 1.4 FIRE A B',
            availableModelYears: [2025],
          },
        ],
      },
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
      bootstrapModels: { Fiat: ['Egea'] },
      version: '1',
    })

    expect(result.catalog.models).toEqual([])
    expect(result.mappings.mappings).toEqual([])
    expect(result.summary.modelReviewRequired).toBe(2)
  })
})


describe('marketplace selection paths and review boundaries', () => {
  it.each([
    ['renault:clio', 'EVOLUTION 1.0 TCE X-TRONIC 90', 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90', ['1.0 TCe', 'Evolution']],
    ['audi:a3', 'SEDAN 35 TFSI 150 ADVANCED STRONIC', 'A3 SEDAN 35 TFSI 150 ADVANCED STRONIC', ['A3 Sedan', '35 TFSI', 'Advanced']],
    ['tesla:model-3', 'LONG RANGE', 'MODEL 3 LONG RANGE', ['Long Range']],
    ['bmw:3-serisi', 'ED 170 SEDAN SPORT LINE', '320i ED 170 SEDAN SPORT LINE', ['320i ED', 'Sport Line']],
    ['bmw:3-serisi', 'SEDAN 1.6 170 50 JAHRE EDITION', '320i SEDAN 1.6 170 50 JAHRE EDITION', ['320i', '50 Jahre Edition']],
    ['mercedes-benz:c-serisi', '180K 1.6 BLUEFFICIENCY AMG', 'C 180K 1.6 BLUEFFICIENCY AMG', ['C 180 Komp. BlueEfficiency', 'AMG']],
  ])('preserves the reviewed path in %s', (series, proposed, raw, path) => {
    expect(canonicalModelSelection(series, proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['renault:clio', 'EVOLUTION MYSTERY 1.0 TCE 90', 'CLIO EVOLUTION MYSTERY 1.0 TCE 90'],
    ['fiat:egea', 'URBAN 1.4 FIRE 95', 'EGEA CROSS URBAN 1.4 FIRE 95'],
    ['audi:a3', '35 TFSI ADVANCED', 'A3 35 TFSI ADVANCED'],
    ['bmw:3-serisi', 'SEDAN XDRIVE COMFORT PLUS', '320d SEDAN XDRIVE COMFORT PLUS'],
    ['tesla:model-3', '150KW', 'MODEL 3 150KW'],
    ['renault:clio', '1.0 TCE 90', 'CLIO 1.0 TCE 90'],
    ['bmw:3-serisi', 'EDITION 100 M SPORT', '320i EDITION 100 M SPORT'],
    ['renault:clio', 'EVOLUTION 100 1.0 TCE 90', 'CLIO EVOLUTION 100 1.0 TCE 90'],
  ])('requires review instead of inventing a path in %s', (series, proposed, raw) => {
    expect(canonicalModelSelection(series, proposed, raw)).toBeNull()
  })

  it('accepts engine-adjacent parenthesized power but rejects prefix and infix edition numbers', () => {
    expect(canonicalModelSelection(
      'renault:clio',
      'EVOLUTION 1.0 TCE (90)',
      'CLIO EVOLUTION 1.0 TCE (90)',
    )?.path).toEqual(['1.0 TCe', 'Evolution'])

    for (const label of [
      '(100) EVOLUTION 1.0 TCE 90',
      'EVOLUTION (100) 1.0 TCE 90',
    ]) {
      expect(canonicalModelSelection('renault:clio', label, `CLIO ${label}`)).toBeNull()
    }
  })

  it('keeps real Accent Blue and Accent Era rows out through the generic Accent fallback', () => {
    const committedAliases: unknown = JSON.parse(readFileSync(committedSeriesAliasesPath, 'utf8'))
    const result = generateCuratedVehicleCatalog({
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '2026-08' },
        records: [
          {
            sourceKey: '177-1014',
            brandRaw: 'HYUNDAI',
            typeRaw: 'ACCENT BLUE 1.6 CRDI MODE PLUS',
            availableModelYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018],
          },
          {
            sourceKey: '177-406',
            brandRaw: 'HYUNDAI',
            typeRaw: 'ACCENT ERA 1.5 CRDI MODE',
            availableModelYears: [2012],
          },
        ],
      },
      brandAliases: { version: '1', aliases: [{ raw: 'HYUNDAI', brandKey: 'hyundai' }] },
      seriesAliases: validateVehicleSeriesAliases(committedAliases),
      bootstrapModels: {},
      version: '1',
    })

    expect(result.catalog.models).toEqual([])
    expect(result.mappings.mappings).toEqual([])
    expect(result.candidates).toEqual([
      expect.objectContaining({
        sourceKey: '177-1014',
        proposedModelLabel: 'BLUE 1.6 CRDI MODE PLUS',
        modelStatus: 'model-review',
        vehicleModelKey: null,
      }),
      expect.objectContaining({
        sourceKey: '177-406',
        proposedModelLabel: 'ERA 1.5 CRDI MODE',
        modelStatus: 'model-review',
        vehicleModelKey: null,
      }),
    ])
  })

  it('normalizes reviewed Clio tokens but leaves equivalent unreviewed Civic variants for review', () => {
    expect(canonicalModelSelection(
      'renault:clio',
      'HB EVOLUTION 1.0 TCE X-TRONIC 90',
      'CLIO HB EVOLUTION 1.0 TCE X-TRONIC 90',
    )?.path).toEqual(['1.0 TCe', 'Evolution'])

    expect(canonicalModelSelection(
      'honda:civic',
      '1.6 EXECUTIVE',
      'CIVIC 1.6 EXECUTIVE',
    )?.path).toEqual(['1.6', 'Executive'])

    for (const label of [
      'HB 1.6 EXECUTIVE',
      '1.6 OTOMATIK EXECUTIVE',
      '1.6 125 EXECUTIVE',
      '1.6 125 HP EXECUTIVE',
      '1.6 (125) EXECUTIVE',
    ]) {
      expect(canonicalModelSelection('honda:civic', label, `CIVIC ${label}`)).toBeNull()
    }
  })

  it('does not infer the BMW Standart trim outside the reviewed 3 Series policy', () => {
    expect(canonicalModelSelection('bmw:5-serisi', '', '520i')).toBeNull()
  })

  it.each([
    ['volkswagen:polo', 'HB 1.0 TSI 95 DSG LIFE', 'POLO HB 1.0 TSI 95 DSG LIFE', ['1.0 TSI', 'Life']],
    ['volkswagen:golf', 'HATCHBACK 1.0 TSI 110 DSG LIFE', 'GOLF HATCHBACK 1.0 TSI 110 DSG LIFE', ['1.0 TSI', 'Life']],
    ['peugeot:308', '5KAPI ACTIVE 1.6 E-HDI 112 AUTO6R', '308 5KAPI ACTIVE 1.6 E-HDI 112 AUTO6R', ['1.6 e-HDi', 'Active']],
    ['fiat:egea', 'SEDAN EASY 1.4 FIRE 95', 'EGEA SEDAN EASY 1.4 FIRE 95', ['1.4 Fire', 'Easy']],
    ['toyota:corolla', 'SEDAN 1.5 FLAME MULTIDRIVE S', 'COROLLA SEDAN 1.5 FLAME MULTIDRIVE S', ['1.5', 'Flame']],
    ['bmw:3-serisi', 'SEDAN 1.6 170 SPORT LINE', '320i SEDAN 1.6 170 SPORT LINE', ['320i', 'Sport Line']],
    ['mercedes-benz:c-serisi', '180 LIMOUSINE 1.6 AMG 7G-TRONIC', 'C 180 LIMOUSINE 1.6 AMG 7G-TRONIC', ['C 180', 'AMG']],
  ])('applies reviewed body and technical policy for %s', (series, proposed, raw, path) => {
    expect(canonicalModelSelection(series, proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['volkswagen:polo', 'SEDAN 1.0 TSI 95 DSG LIFE', 'POLO SEDAN 1.0 TSI 95 DSG LIFE'],
    ['toyota:corolla', 'HB 1.5 FLAME MULTIDRIVE S', 'COROLLA HB 1.5 FLAME MULTIDRIVE S'],
    ['bmw:3-serisi', 'HATCHBACK 1.6 170 SPORT LINE', '320i HATCHBACK 1.6 170 SPORT LINE'],
  ])('does not strip an unreviewed body for %s', (series, proposed, raw) => {
    expect(canonicalModelSelection(series, proposed, raw)).toBeNull()
  })

  it('excludes distinct reviewed trim labels with colliding slugs', () => {
    const result = generateCuratedVehicleCatalog({
      snapshot: { provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '1' }, records: ['EXECUTIVE', 'EXECUTIVE+'].map((trim, i) => ({
        sourceKey: String(i), brandRaw: 'HONDA', typeRaw: `CIVIC 1.6 ${trim}`, availableModelYears: [2025],
      })) },
      brandAliases: { version: '1', aliases: [{ raw: 'HONDA', brandKey: 'honda' }] },
      seriesAliases: { version: '1', entries: [{ brandKey: 'honda', seriesKey: 'honda:civic', aliases: ['CIVIC'] }] },
      bootstrapModels: {}, version: '1',
    })
    expect(result.summary.slugCollisionsExcluded).toBe(2)
    expect(result.catalog.models).toEqual([])
    expect(result.mappings.mappings).toEqual([])
  })

  it('preserves reviewed leaf and branch keys across a display correction', () => {
    const args: Parameters<typeof generateCuratedVehicleCatalog>[0] = {
      snapshot: { provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '1' }, records: [{ sourceKey: 'r', brandRaw: 'RENAULT (OYAK)', typeRaw: 'CLIO EVOLUTION 1.0 TCE 90', availableModelYears: [2025] }] },
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()), seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()), bootstrapModels: {}, version: '1',
    }
    const original = generateCuratedVehicleCatalog(args)
    const model = original.catalog.models[0]!
    model.key = 'renault:clio:stable-leaf'
    model.name = 'Old display label'
    model.selectionPath = [{ key: 'renault:clio:stable-group', name: 'Old group spelling' }, { key: model.key, name: 'Old trim spelling' }]
    original.mappings.mappings[0]!.vehicleModelKey = model.key
    const next = generateCuratedVehicleCatalog({ ...args, baseline: original })
    expect(next.catalog.models[0]).toMatchObject({ key: model.key, name: '1.0 TCe Evolution', selectionPath: [{ key: 'renault:clio:stable-group', name: '1.0 TCe' }, { key: model.key, name: 'Evolution' }] })
    expect(next.mappings.mappings[0]!.vehicleModelKey).toBe(model.key)
    args.snapshot.records.push({ ...args.snapshot.records[0]!, sourceKey: 'r2', typeRaw: 'CLIO JOY 1.0 TCE 90' })
    original.mappings.mappings.push({ sourceKey: 'r2', vehicleModelKey: model.key, method: 'exact-rule' })
    expect(() => generateCuratedVehicleCatalog({ ...args, baseline: original })).toThrow('Identity split requires review')
  })

  it('shares a baseline stable branch key with new siblings independent of source order', () => {
    const originalArgs: Parameters<typeof generateCuratedVehicleCatalog>[0] = {
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '1' },
        records: [{
          sourceKey: 'evolution',
          brandRaw: 'RENAULT (OYAK)',
          typeRaw: 'CLIO EVOLUTION 1.0 TCE 90',
          availableModelYears: [2025],
        }],
      },
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
      bootstrapModels: {},
      version: '1',
    }
    const baseline = generateCuratedVehicleCatalog(originalArgs)
    baseline.catalog.models[0]!.selectionPath![0]!.key = 'renault:clio:stable-engine-group'

    const records = [
      ...originalArgs.snapshot.records,
      {
        sourceKey: 'joy',
        brandRaw: 'RENAULT (OYAK)',
        typeRaw: 'CLIO JOY 1.0 TCE 90',
        availableModelYears: [2025],
      },
    ]
    const generate = (orderedRecords: typeof records) => generateCuratedVehicleCatalog({
      ...originalArgs,
      snapshot: { ...originalArgs.snapshot, records: orderedRecords },
      baseline,
    })

    const forward = generate(records)
    const reverse = generate([...records].reverse())
    expect(forward.catalog.models.map((model) => model.selectionPath![0]!.key)).toEqual([
      'renault:clio:stable-engine-group',
      'renault:clio:stable-engine-group',
    ])
    expect(() => validateVehicleCatalog(forward.catalog)).not.toThrow()
    expect(reverse.catalog).toEqual(forward.catalog)
    expect(reverse.mappings).toEqual(forward.mappings)
  })

  it('rejects conflicting stable branch consolidations and splits', () => {
    const argsFor = (records: Array<{ sourceKey: string; typeRaw: string }>): Parameters<typeof generateCuratedVehicleCatalog>[0] => ({
      snapshot: {
        provider: { code: 'tsb-kasko', sourceName: 'TSB', version: '1' },
        records: records.map((record) => ({
          ...record,
          brandRaw: 'RENAULT (OYAK)',
          availableModelYears: [2025],
        })),
      },
      brandAliases: validateVehicleBrandAliases(brandAliasesInput()),
      seriesAliases: validateVehicleSeriesAliases(seriesAliasesInput()),
      bootstrapModels: {},
      version: '1',
    })

    const consolidationArgs = argsFor([
      { sourceKey: 'evolution', typeRaw: 'CLIO EVOLUTION 1.0 TCE 90' },
      { sourceKey: 'joy', typeRaw: 'CLIO JOY 1.0 TCE 90' },
    ])
    const consolidationBaseline = generateCuratedVehicleCatalog(consolidationArgs)
    consolidationBaseline.catalog.models[0]!.selectionPath![0]!.key = 'renault:clio:first-stable-group'
    consolidationBaseline.catalog.models[1]!.selectionPath![0]!.key = 'renault:clio:second-stable-group'
    expect(() => generateCuratedVehicleCatalog({
      ...consolidationArgs,
      baseline: consolidationBaseline,
    })).toThrow('Selection branch consolidation requires review')

    const splitArgs = argsFor([
      { sourceKey: 'evolution', typeRaw: 'CLIO EVOLUTION 1.0 TCE 90' },
      { sourceKey: 'joy', typeRaw: 'CLIO JOY 0.9 TCE 90' },
    ])
    const splitBaseline = generateCuratedVehicleCatalog(splitArgs)
    for (const model of splitBaseline.catalog.models) {
      model.selectionPath![0]!.key = 'renault:clio:shared-stable-group'
    }
    expect(() => generateCuratedVehicleCatalog({ ...splitArgs, baseline: splitBaseline }))
      .toThrow('Selection branch split or reparenting requires review')
  })
})
