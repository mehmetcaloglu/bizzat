import { AppError } from '../../common/errors/app-error.js'
import type { ReferenceVehicleItem, VehicleCatalogRepository } from './vehicle-catalog.repository.js'

export class VehicleCatalogService {
  constructor(private readonly repository: VehicleCatalogRepository) {}

  listBrands(): Promise<ReferenceVehicleItem[]> {
    return this.repository.listActiveBrands()
  }

  async listSeries(brandId: string): Promise<ReferenceVehicleItem[]> {
    const brand = await this.repository.findActiveBrandById(brandId)
    if (!brand) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç markası bulunamadı.')
    }
    return this.repository.listActiveSeries(brandId)
  }

  async listModels(seriesId: string): Promise<ReferenceVehicleItem[]> {
    const series = await this.repository.findActiveSeriesById(seriesId)
    if (!series) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç serisi bulunamadı.')
    }
    return this.repository.listActiveModels(seriesId)
  }
}
