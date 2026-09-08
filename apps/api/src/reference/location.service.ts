import { AppError } from '../common/errors/app-error.js'
import type {
  LocationRepository,
  ReferenceDistrict,
  ReferenceNeighborhood,
  ReferenceProvince,
} from './location.repository.js'

export class LocationService {
  constructor(private readonly repository: LocationRepository) {}

  listProvinces(): Promise<ReferenceProvince[]> {
    return this.repository.listActiveProvinces()
  }

  async listDistricts(provinceId: string): Promise<ReferenceDistrict[]> {
    const province = await this.repository.findActiveProvinceById(provinceId)
    if (!province) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Konum bulunamadı.')
    }
    return this.repository.listActiveDistricts(provinceId)
  }

  async listNeighborhoods(districtId: string): Promise<ReferenceNeighborhood[]> {
    const district = await this.repository.findActiveDistrictById(districtId)
    if (!district) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Konum bulunamadı.')
    }
    return this.repository.listActiveNeighborhoods(districtId)
  }
}
