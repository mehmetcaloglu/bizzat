export interface VehicleBrandAliasesFile {
  version: string
  aliases: Array<{
    raw: string
    brandKey: string
  }>
}

export interface VehicleSeriesAliasesFile {
  version: string
  entries: Array<{
    brandKey: string
    seriesKey: string
    aliases: string[]
  }>
}

export type VehicleCurationCandidateStatus =
  | 'exact-series'
  | 'ambiguous-series'
  | 'unknown-brand'
  | 'no-series'

export interface VehicleCurationCandidate {
  sourceKey: string
  brandRaw: string
  typeRaw: string
  brandKeyCandidate: string | null
  seriesKeyCandidate: string | null
  proposedModelLabel: string | null
  status: VehicleCurationCandidateStatus
}
