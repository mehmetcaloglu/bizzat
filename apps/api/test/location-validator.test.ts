import { describe, expect, it } from 'vitest'
import { checksumLocationSnapshot } from '../src/reference/import/location-checksum.js'
import type { NormalizedLocationSnapshot } from '../src/reference/import/location-import.types.js'
import { validateLocationSnapshot } from '../src/reference/import/location-validator.js'

function snapshot(): NormalizedLocationSnapshot {
  return {
    provider: { code: 'fixture', sourceName: 'Fixture', version: '1' },
    provinces: [{ sourceKey: '34', code: '34', name: 'İstanbul' }],
    districts: [{ sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' }],
    neighborhoods: [{ sourceKey: '34-gungoren-haznedar', districtSourceKey: '34-gungoren', name: 'Haznedar' }],
  }
}

describe('location snapshot validation', () => {
  it('accepts a valid hierarchy', () => {
    expect(() => validateLocationSnapshot(snapshot())).not.toThrow()
  })

  it('rejects duplicate province source keys', () => {
    const value = snapshot()
    value.provinces.push({ sourceKey: '34', code: '06', name: 'Ankara' })
    expect(() => validateLocationSnapshot(value)).toThrow(/Duplicate province source key/)
  })

  it('rejects duplicate province codes', () => {
    const value = snapshot()
    value.provinces.push({ sourceKey: '06', code: '34', name: 'Ankara' })
    expect(() => validateLocationSnapshot(value)).toThrow(/Duplicate province code/)
  })

  it('rejects orphan districts', () => {
    const value = snapshot()
    value.districts[0]!.provinceSourceKey = 'missing'
    expect(() => validateLocationSnapshot(value)).toThrow(/Unknown province source key/)
  })

  it('rejects orphan neighborhoods', () => {
    const value = snapshot()
    value.neighborhoods[0]!.districtSourceKey = 'missing'
    expect(() => validateLocationSnapshot(value)).toThrow(/Unknown district source key/)
  })

  it('rejects empty metadata and names', () => {
    const value = snapshot()
    value.provider.version = ' '
    expect(() => validateLocationSnapshot(value)).toThrow(/provider.version is required/)

    const second = snapshot()
    second.neighborhoods[0]!.name = ' '
    expect(() => validateLocationSnapshot(second)).toThrow(/neighborhood.name is required/)
  })

  it('produces the same checksum independent of array insertion order', () => {
    const first = snapshot()
    first.provinces.push({ sourceKey: '06', code: '06', name: 'Ankara' })
    first.districts.push({ sourceKey: '06-cankaya', provinceSourceKey: '06', name: 'Çankaya' })
    first.neighborhoods.push({ sourceKey: '06-cankaya-balgat', districtSourceKey: '06-cankaya', name: 'Balgat' })

    const second: NormalizedLocationSnapshot = {
      ...first,
      provinces: [...first.provinces].reverse(),
      districts: [...first.districts].reverse(),
      neighborhoods: [...first.neighborhoods].reverse(),
    }

    expect(checksumLocationSnapshot(first)).toBe(checksumLocationSnapshot(second))
  })
})
