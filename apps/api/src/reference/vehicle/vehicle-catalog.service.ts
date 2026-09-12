import { AppError } from '../../common/errors/app-error.js'
import type {
  ActiveVehicleSelectionModel,
  ReferenceVehicleItem,
  VehicleCatalogRepository,
} from './vehicle-catalog.repository.js'

export type ReferenceVehicleSelectionItem =
  | { key: string; name: string; kind: 'group' }
  | { key: string; name: string; kind: 'model'; id: string }

function selectionPath(model: ActiveVehicleSelectionModel) {
  return model.selectionPath ?? [{ key: model.catalogKey, name: model.name }]
}

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

  async listSelection(
    seriesId: string,
    parentKey?: string,
  ): Promise<ReferenceVehicleSelectionItem[]> {
    const series = await this.repository.findActiveSeriesById(seriesId)
    if (!series) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç serisi bulunamadı.')
    }

    const models = await this.repository.listActiveSelectionModels(seriesId)
    const items = new Map<string, ReferenceVehicleSelectionItem>()
    let parentFound = parentKey === undefined

    for (const model of models) {
      const path = selectionPath(model)
      const parentIndex = parentKey === undefined
        ? -1
        : path.findIndex((node) => node.key === parentKey)
      if (parentIndex >= 0) parentFound = true
      if (parentKey !== undefined && parentIndex < 0) continue

      const childIndex = parentIndex + 1
      if (childIndex < 0 || childIndex >= path.length) continue
      const child = path[childIndex]!
      const item: ReferenceVehicleSelectionItem = childIndex === path.length - 1
        ? { key: child.key, name: child.name, kind: 'model', id: model.id }
        : { key: child.key, name: child.name, kind: 'group' }
      items.set(item.key, item)
    }

    if (parentKey !== undefined && (!parentFound || items.size === 0)) {
      throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç seçim düğümü bulunamadı.')
    }

    return [...items.values()].sort((left, right) => (
      left.name.localeCompare(right.name, 'tr') || left.key.localeCompare(right.key)
    ))
  }
}
