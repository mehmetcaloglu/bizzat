import { describe, expect, it } from 'vitest'
import {
  initialVehiclePickerState,
  selectBrand,
  selectGroup,
  selectModel,
  selectSeries,
} from '../app/ilan-ver/otomobil/vehicle-picker-state.js'

const brand = { id: 'brand-1', name: 'Renault' }
const otherBrand = { id: 'brand-2', name: 'Volkswagen' }
const series = { id: 'series-1', name: 'Clio' }
const otherSeries = { id: 'series-2', name: 'Megane' }
const engine = { key: 'renault:clio:1-0-tce', name: '1.0 TCe', kind: 'group' as const }
const otherEngine = { key: 'renault:clio:1-5-dci', name: '1.5 dCi', kind: 'group' as const }
const model = {
  key: 'renault:clio:1-0-tce-evolution',
  name: 'Evolution',
  kind: 'model' as const,
  id: 'model-1',
}

function completedState() {
  let state = selectBrand(initialVehiclePickerState, brand)
  state = selectSeries(state, series)
  state = selectGroup(state, 0, engine)
  return selectModel(state, 1, model)
}

describe('vehicle picker state', () => {
  it('clears series, descendants and terminal model when brand changes', () => {
    const state = selectBrand(completedState(), otherBrand)

    expect(state).toEqual({
      brand: otherBrand,
      series: null,
      path: [],
      vehicleModelId: null,
    })
  })

  it('clears descendants and terminal model when series changes', () => {
    const state = selectSeries(completedState(), otherSeries)

    expect(state.brand).toEqual(brand)
    expect(state.series).toEqual(otherSeries)
    expect(state.path).toEqual([])
    expect(state.vehicleModelId).toBeNull()
  })

  it('truncates stale descendants when a group changes at an earlier depth', () => {
    const state = selectGroup(completedState(), 0, otherEngine)

    expect(state.path).toEqual([otherEngine])
    expect(state.vehicleModelId).toBeNull()
  })

  it('sets only the selected terminal model as the persisted vehicle identity', () => {
    let state = selectBrand(initialVehiclePickerState, brand)
    state = selectSeries(state, series)
    state = selectGroup(state, 0, engine)
    state = selectModel(state, 1, model)

    expect(state.path).toEqual([engine, model])
    expect(state.vehicleModelId).toBe(model.id)
  })
})
