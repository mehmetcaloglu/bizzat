export interface LocationProviderMeta {
  code: string
  sourceName: string
  sourceUrl?: string
  license?: string
  version: string
}

export interface ImportProvince {
  sourceKey: string
  code: string
  name: string
}

export interface ImportDistrict {
  sourceKey: string
  provinceSourceKey: string
  name: string
}

export interface ImportNeighborhood {
  sourceKey: string
  districtSourceKey: string
  name: string
  kind?: string
}

export interface NormalizedLocationSnapshot {
  provider: LocationProviderMeta
  provinces: ImportProvince[]
  districts: ImportDistrict[]
  neighborhoods: ImportNeighborhood[]
}
