import type { VehicleMappingMethod } from '../../../db/client.js'

export interface VehicleSourceMappingFile {
  version: string
  mappings: Array<{
    sourceKey: string
    vehicleModelKey: string
    method: VehicleMappingMethod
  }>
}

export interface VehicleSourceMappingApplyResult {
  applied: number
}
