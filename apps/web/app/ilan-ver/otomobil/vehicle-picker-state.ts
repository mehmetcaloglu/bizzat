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

export interface PickerInteractionStateInput {
  authenticated: boolean
  vehicleModelId: string | null
  isCreatingDraft: boolean
  hasCreatedDraft: boolean
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

export function getPickerInteractionState(
  input: PickerInteractionStateInput,
): { selectionDisabled: boolean; canCreateDraft: boolean } {
  const selectionDisabled = !input.authenticated || input.isCreatingDraft
  const canCreateDraft = input.authenticated
    && input.vehicleModelId !== null
    && !input.isCreatingDraft
    && !input.hasCreatedDraft

  return { selectionDisabled, canCreateDraft }
}

export function removeUnavailableModelFromLevels(
  levels: VehicleSelectionItem[][],
  vehicleModelId: string,
): VehicleSelectionItem[][] {
  return levels.map((items) => items.filter((item) => (
    item.kind !== 'model' || item.id !== vehicleModelId
  )))
}
