import { describe, expect, it } from 'vitest'
import {
  VehicleAliasValidationError,
  validateVehicleBrandAliases,
  validateVehicleSeriesAliases,
} from '../src/reference/vehicle/curation/alias-validator.js'
import { generateVehicleCurationCandidates } from '../src/reference/vehicle/curation/candidate-generator.js'
import type { NormalizedVehicleSourceSnapshot } from '../src/reference/vehicle/source/source.types.js'

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