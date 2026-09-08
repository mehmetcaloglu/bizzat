export interface NormalizedVehicleSourceSnapshot {
  provider: {
    code: 'tsb-kasko'
    sourceName: string
    sourceUrl?: string
    version: string
  }
  records: Array<{
    sourceKey: string
    brandRaw: string
    typeRaw: string
    availableModelYears: number[]
  }>
}

export interface VehicleSourceImportResult {
  providerId: string
  importId: string
  checksum: string
  counts: {
    inserted: number
    updated: number
    reactivated: number
    deactivated: number
    reviewRequiredSet: number
  }
}
