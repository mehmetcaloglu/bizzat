export interface CanonicalVehicleBrand {
  key: string
  name: string
}

export interface CanonicalVehicleSeries {
  key: string
  brandKey: string
  name: string
}

export interface CanonicalVehicleModel {
  key: string
  seriesKey: string
  name: string
}

export interface CanonicalVehicleCatalog {
  version: string
  brands: CanonicalVehicleBrand[]
  series: CanonicalVehicleSeries[]
  models: CanonicalVehicleModel[]
}
