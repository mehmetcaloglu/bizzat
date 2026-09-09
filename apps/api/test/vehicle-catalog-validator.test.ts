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
      {
        key: 'renault:clio:1-0-tce-joy',
        seriesKey: 'renault:clio',
        name: '1.0 TCe Joy',
        selectionPath: [
          { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
          { key: 'renault:clio:1-0-tce-joy', name: 'Joy' },
        ],
      },
      { key: 'fiat:egea:1-4-fire-easy', seriesKey: 'fiat:egea', name: '1.4 Fire Easy' },
    ],
  }
}

function expectInvalid(value: unknown): void {
  expect(() => validateVehicleCatalog(value)).toThrow(VehicleCatalogValidationError)
}

describe('vehicle catalog validator', () => {
  it('accepts selection paths and legacy models without a path', () => {
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

  it.each([
    null,
    {},
    [],
    ['invalid-node'],
    [{ key: 'node-only' }],
    [{ name: 'Name only' }],
    [{ key: '   ', name: 'Blank key' }],
    [{ key: 'blank-name', name: '   ' }],
  ])('rejects a malformed selection path: %o', (selectionPath) => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models[0]!.selectionPath = selectionPath
    expectInvalid(value)
  })

  it('requires the terminal selection key to equal the model key', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models[0]!.selectionPath = [
      { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
      { key: 'renault:clio:different-leaf', name: 'Joy' },
    ]
    expectInvalid(value)
  })

  it('rejects duplicate keys within one selection path', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models[0]!.selectionPath = [
      { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
      { key: 'renault:clio:1-0-tce', name: 'Cycle' },
      { key: 'renault:clio:1-0-tce-joy', name: 'Joy' },
    ]
    expectInvalid(value)
  })

  it('rejects a shared node key with conflicting names', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models.push({
      key: 'renault:clio:1-0-tce-evolution',
      seriesKey: 'renault:clio',
      name: '1.0 TCe Evolution',
      selectionPath: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe Updated' },
        { key: 'renault:clio:1-0-tce-evolution', name: 'Evolution' },
      ],
    })
    expectInvalid(value)
  })

  it('rejects a shared node key used by different series', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models.push({
      key: 'fiat:egea:1-0-tce-easy',
      seriesKey: 'fiat:egea',
      name: '1.0 TCe Easy',
      selectionPath: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
        { key: 'fiat:egea:1-0-tce-easy', name: 'Easy' },
      ],
    })
    expectInvalid(value)
  })

  it('rejects a shared node key reached through a different path', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models.push({
      key: 'renault:clio:sport-tourer:1-0-tce-evolution',
      seriesKey: 'renault:clio',
      name: 'Sport Tourer 1.0 TCe Evolution',
      selectionPath: [
        { key: 'renault:clio:sport-tourer', name: 'Sport Tourer' },
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
        { key: 'renault:clio:sport-tourer:1-0-tce-evolution', name: 'Evolution' },
      ],
    })
    expectInvalid(value)
  })

  it('rejects a node used as both a terminal model and a branch', () => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models.push({
      key: 'renault:clio:1-0-tce-joy-plus',
      seriesKey: 'renault:clio',
      name: '1.0 TCe Joy Plus',
      selectionPath: [
        { key: 'renault:clio:1-0-tce-joy', name: 'Joy' },
        { key: 'renault:clio:1-0-tce-joy-plus', name: 'Plus' },
      ],
    })
    expectInvalid(value)
  })

  it.each([
    {
      key: 'renault:clio:alternate-engine:joy',
      selectionPath: [
        { key: 'renault:clio:alternate-engine', name: ' 1.0 TCe ' },
        { key: 'renault:clio:alternate-engine:joy', name: 'Joy' },
      ],
    },
    {
      key: 'renault:clio:1-0-tce:alternate-joy',
      selectionPath: [
        { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
        { key: 'renault:clio:1-0-tce:alternate-joy', name: ' Joy ' },
      ],
    },
  ])('rejects duplicate sibling labels with different keys: %o', ({ key, selectionPath }) => {
    const value = validCatalog() as { models: Array<Record<string, unknown>> }
    value.models.push({
      key,
      seriesKey: 'renault:clio',
      name: 'Alternate model',
      selectionPath,
    })
    expectInvalid(value)
  })
})
