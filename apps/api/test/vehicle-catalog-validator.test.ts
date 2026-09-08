import { describe, expect, it } from 'vitest'
import { validateVehicleCatalog, VehicleCatalogValidationError } from '../src/reference/vehicle/catalog-validator.js'

function validCatalog(): unknown {
  return {
    version: 'fixture-1',
    brands: [
      { key: 'renault', name: 'Renault' },
      { key: 'fiat', name: 'Fiat' },
    ],
    series: [
      { key: 'renault:clio', brandKey: 'renault', name: 'Clio' },
      { key: 'fiat:egea', brandKey: 'fiat', name: 'Egea' },
    ],
    models: [
      { key: 'renault:clio:1-0-tce-joy', seriesKey: 'renault:clio', name: '1.0 TCe Joy' },
      { key: 'fiat:egea:1-4-fire-easy', seriesKey: 'fiat:egea', name: '1.4 Fire Easy' },
    ],
  }
}

function expectInvalid(value: unknown): void {
  expect(() => validateVehicleCatalog(value)).toThrow(VehicleCatalogValidationError)
}

describe('vehicle catalog validator', () => {
  it('accepts a valid catalog and narrows unknown input', () => {
    const value = validCatalog()
    expect(() => validateVehicleCatalog(value)).not.toThrow()
  })

  it('rejects malformed top-level shapes', () => {
    expectInvalid(null)
    expectInvalid({})
    expectInvalid({ version: '1', brands: {}, series: [], models: [] })
  })

  it('rejects blank version', () => {
    const value = validCatalog() as { version: string }
    value.version = '   '
    expectInvalid(value)
  })

  it('rejects duplicate brand keys', () => {
    const value = validCatalog() as { brands: Array<{ key: string; name: string }> }
    value.brands.push({ key: 'renault', name: 'Renault Duplicate' })
    expectInvalid(value)
  })

  it('rejects duplicate series keys', () => {
    const value = validCatalog() as { series: Array<{ key: string; brandKey: string; name: string }> }
    value.series.push({ key: 'renault:clio', brandKey: 'renault', name: 'Clio Duplicate' })
    expectInvalid(value)
  })

  it('rejects duplicate model keys', () => {
    const value = validCatalog() as { models: Array<{ key: string; seriesKey: string; name: string }> }
    value.models.push({ key: 'renault:clio:1-0-tce-joy', seriesKey: 'renault:clio', name: 'Duplicate' })
    expectInvalid(value)
  })

  it('rejects blank display names', () => {
    const value = validCatalog() as { models: Array<{ key: string; seriesKey: string; name: string }> }
    value.models[0]!.name = ' '
    expectInvalid(value)
  })

  it('rejects a series whose brandKey does not exist', () => {
    const value = validCatalog() as { series: Array<{ key: string; brandKey: string; name: string }> }
    value.series[0]!.brandKey = 'missing-brand'
    expectInvalid(value)
  })

  it('rejects a model whose seriesKey does not exist', () => {
    const value = validCatalog() as { models: Array<{ key: string; seriesKey: string; name: string }> }
    value.models[0]!.seriesKey = 'missing-series'
    expectInvalid(value)
  })
})
