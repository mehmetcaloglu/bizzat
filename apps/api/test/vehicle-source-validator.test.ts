import { describe, expect, it } from 'vitest'
import { checksumVehicleSourceSnapshot } from '../src/reference/vehicle/source/source-checksum.js'
import {
  VehicleSourceMappingValidationError,
  validateVehicleSourceMappingFile,
} from '../src/reference/vehicle/source/mapping-validator.js'
import { normalizeVehicleSourceIdentity } from '../src/reference/vehicle/source/source-normalization.js'
import {
  VehicleSourceValidationError,
  validateAndNormalizeVehicleSourceSnapshot,
} from '../src/reference/vehicle/source/source-validator.js'

const fixedNow = new Date('2026-09-08T00:00:00Z')

function makeInput(): unknown {
  return {
    provider: {
      code: 'tsb-kasko',
      sourceName: ' Türkiye Sigorta Birliği Kasko Değer Listesi ',
      sourceUrl: ' https://www.tsb.org.tr/tr/kasko-arsiv-listesi ',
      version: ' 2026-09 ',
    },
    records: [
      {
        sourceKey: ' 144-1064 ',
        brandRaw: ' TOYOTA ',
        typeRaw: ' COROLLA   1.33 LIFE ',
        availableModelYears: [2018, 2016, 2017, 2018],
      },
      {
        sourceKey: '122-1260',
        brandRaw: 'RENAULT (OYAK)',
        typeRaw: 'CLIO EVOLUTION 1.0 TCE X-TRONIC 90',
        availableModelYears: [2024, 2023, 2022],
      },
    ],
  }
}

function makeMappingInput(): unknown {
  return {
    version: ' fixture-1 ',
    mappings: [
      {
        sourceKey: ' 144-1064 ',
        vehicleModelKey: ' toyota:corolla:1-33-life ',
        method: 'curated-import',
      },
    ],
  }
}

describe('vehicle source snapshot validation', () => {
  it('accepts unknown input and returns normalized runtime data', () => {
    const value = validateAndNormalizeVehicleSourceSnapshot(makeInput(), fixedNow)
    expect(value.provider).toEqual({
      code: 'tsb-kasko',
      sourceName: 'Türkiye Sigorta Birliği Kasko Değer Listesi',
      sourceUrl: 'https://www.tsb.org.tr/tr/kasko-arsiv-listesi',
      version: '2026-09',
    })
    expect(value.records[0]).toEqual({
      sourceKey: '144-1064',
      brandRaw: 'TOYOTA',
      typeRaw: 'COROLLA 1.33 LIFE',
      availableModelYears: [2016, 2017, 2018],
    })
  })

  it('rejects unsupported providers, empty snapshots and malformed shapes', () => {
    const unsupported = makeInput() as { provider: { code: string } }
    unsupported.provider.code = 'other'
    expect(() => validateAndNormalizeVehicleSourceSnapshot(unsupported, fixedNow))
      .toThrow(VehicleSourceValidationError)

    const empty = makeInput() as { records: unknown[] }
    empty.records = []
    expect(() => validateAndNormalizeVehicleSourceSnapshot(empty, fixedNow))
      .toThrow(VehicleSourceValidationError)

    expect(() => validateAndNormalizeVehicleSourceSnapshot({ provider: null }, fixedNow))
      .toThrow(VehicleSourceValidationError)
  })

  it('rejects duplicate and blank source identities', () => {
    const duplicate = makeInput() as { records: Array<Record<string, unknown>> }
    duplicate.records[1]!.sourceKey = ' 144-1064 '
    expect(() => validateAndNormalizeVehicleSourceSnapshot(duplicate, fixedNow))
      .toThrow(VehicleSourceValidationError)

    for (const field of ['sourceKey', 'brandRaw', 'typeRaw'] as const) {
      const blank = makeInput() as { records: Array<Record<string, unknown>> }
      blank.records[0]![field] = '   '
      expect(() => validateAndNormalizeVehicleSourceSnapshot(blank, fixedNow))
        .toThrow(VehicleSourceValidationError)
    }
  })

  it('rejects empty, non-integer and out-of-range year arrays', () => {
    for (const years of [[], [2020.5], [1885], [2028]]) {
      const value = makeInput() as { records: Array<Record<string, unknown>> }
      value.records[0]!.availableModelYears = years
      expect(() => validateAndNormalizeVehicleSourceSnapshot(value, fixedNow))
        .toThrow(VehicleSourceValidationError)
    }
  })
})

describe('vehicle source identity normalization', () => {
  it('treats case and whitespace-only differences as equal', () => {
    expect(normalizeVehicleSourceIdentity(' Clio   Evolution 1.0 TCE '))
      .toBe(normalizeVehicleSourceIdentity('clio evolution 1.0 tce'))
  })

  it('keeps meaningful vehicle tokens distinct', () => {
    expect(normalizeVehicleSourceIdentity('CLIO EVOLUTION 1.0 TCE'))
      .not.toBe(normalizeVehicleSourceIdentity('CLIO EVOLUTION 1.3 TCE'))
  })
})

describe('vehicle source checksum', () => {
  it('is independent from record and year input order', () => {
    const first = validateAndNormalizeVehicleSourceSnapshot(makeInput(), fixedNow)
    const reorderedInput = makeInput() as {
      records: Array<{
        availableModelYears: number[]
        [key: string]: unknown
      }>
    }
    reorderedInput.records.reverse()
    for (const record of reorderedInput.records) record.availableModelYears.reverse()
    const second = validateAndNormalizeVehicleSourceSnapshot(reorderedInput, fixedNow)

    expect(checksumVehicleSourceSnapshot(second)).toBe(checksumVehicleSourceSnapshot(first))
  })
})

describe('vehicle source mapping file validation', () => {
  it('accepts unknown input, trims identity fields, and accepts the three mapping methods', () => {
    const value = makeMappingInput() as {
      version: string
      mappings: Array<Record<string, unknown>>
    }
    value.mappings.push(
      { sourceKey: '122-1260', vehicleModelKey: 'renault:clio:1-0-tce-evolution', method: 'manual' },
      { sourceKey: '100-0001', vehicleModelKey: 'fiat:egea:1-4-fire-easy', method: 'exact-rule' },
    )

    expect(validateVehicleSourceMappingFile(value)).toEqual({
      version: 'fixture-1',
      mappings: [
        { sourceKey: '144-1064', vehicleModelKey: 'toyota:corolla:1-33-life', method: 'curated-import' },
        { sourceKey: '122-1260', vehicleModelKey: 'renault:clio:1-0-tce-evolution', method: 'manual' },
        { sourceKey: '100-0001', vehicleModelKey: 'fiat:egea:1-4-fire-easy', method: 'exact-rule' },
      ],
    })
  })

  it('rejects malformed shapes, blank fields, duplicate source keys and unknown methods', () => {
    expect(() => validateVehicleSourceMappingFile(null)).toThrow(VehicleSourceMappingValidationError)

    const blankVersion = makeMappingInput() as { version: string }
    blankVersion.version = '   '
    expect(() => validateVehicleSourceMappingFile(blankVersion)).toThrow(VehicleSourceMappingValidationError)

    const notArray = makeMappingInput() as { mappings: unknown }
    notArray.mappings = {}
    expect(() => validateVehicleSourceMappingFile(notArray)).toThrow(VehicleSourceMappingValidationError)

    for (const field of ['sourceKey', 'vehicleModelKey'] as const) {
      const blank = makeMappingInput() as { mappings: Array<Record<string, unknown>> }
      blank.mappings[0]![field] = '   '
      expect(() => validateVehicleSourceMappingFile(blank)).toThrow(VehicleSourceMappingValidationError)
    }

    const duplicate = makeMappingInput() as { mappings: Array<Record<string, unknown>> }
    duplicate.mappings.push({
      sourceKey: '144-1064',
      vehicleModelKey: 'other:model',
      method: 'manual',
    })
    expect(() => validateVehicleSourceMappingFile(duplicate)).toThrow(VehicleSourceMappingValidationError)

    const badMethod = makeMappingInput() as { mappings: Array<Record<string, unknown>> }
    badMethod.mappings[0]!.method = 'fuzzy'
    expect(() => validateVehicleSourceMappingFile(badMethod)).toThrow(VehicleSourceMappingValidationError)
  })
})
