export interface VehicleReferenceItem {
  id: string
  name: string
}

export interface VehicleSelectionGroup {
  key: string
  name: string
  kind: 'group'
}

export interface VehicleSelectionModel {
  key: string
  name: string
  kind: 'model'
  id: string
}

export type VehicleSelectionItem = VehicleSelectionGroup | VehicleSelectionModel

export interface VehiclePickerState {
  brand: VehicleReferenceItem | null
  series: VehicleReferenceItem | null
  path: VehicleSelectionItem[]
  vehicleModelId: string | null
}

export const initialVehiclePickerState: VehiclePickerState = {
  brand: null,
  series: null,
  path: [],
  vehicleModelId: null,
}

export function selectBrand(
  state: VehiclePickerState,
  brand: VehicleReferenceItem,
): VehiclePickerState {
  return {
    ...state,
    brand,
    series: null,
    path: [],
    vehicleModelId: null,
  }
}

export function selectSeries(
  state: VehiclePickerState,
  series: VehicleReferenceItem,
): VehiclePickerState {
  return {
    ...state,
    series,
    path: [],
    vehicleModelId: null,
  }
}

export function selectGroup(
  state: VehiclePickerState,
  depth: number,
  group: VehicleSelectionGroup,
): VehiclePickerState {
  return {
    ...state,
    path: [...state.path.slice(0, depth), group],
    vehicleModelId: null,
  }
}

export function selectModel(
  state: VehiclePickerState,
  depth: number,
  model: VehicleSelectionModel,
): VehiclePickerState {
  return {
    ...state,
    path: [...state.path.slice(0, depth), model],
    vehicleModelId: model.id,
  }
}

export function clearSelectedModel(state: VehiclePickerState): VehiclePickerState {
  const path = state.path.at(-1)?.kind === 'model'
    ? state.path.slice(0, -1)
    : state.path

  return {
    ...state,
    path,
    vehicleModelId: null,
  }
}
