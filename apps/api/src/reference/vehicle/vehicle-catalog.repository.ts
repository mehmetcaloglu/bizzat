import type { Kysely } from 'kysely'
import type { Database } from '../../db/client.js'
import type { VehicleSelectionNode } from './catalog.types.js'

export interface ReferenceVehicleItem {
  id: string
  name: string
}

export interface ActiveVehicleSelectionModel {
  id: string
  catalogKey: string
  name: string
  selectionPath: VehicleSelectionNode[] | null
}

export interface VehicleModelSummaryRow {
  modelId: string
  modelCatalogKey: string
  modelName: string
  selectionPath: VehicleSelectionNode[] | null
  seriesId: string
  seriesName: string
  brandId: string
  brandName: string
}

export class VehicleCatalogRepository {
  constructor(private readonly db: Kysely<Database>) {}

  listActiveBrands(): Promise<ReferenceVehicleItem[]> {
    return this.db
      .selectFrom('vehicle_brands')
      .select(['id', 'name'])
      .where('active', '=', true)
      .orderBy('name', 'asc')
      .execute()
  }

  async findActiveBrandById(id: string): Promise<{ id: string } | null> {
    return await this.db
      .selectFrom('vehicle_brands')
      .select('id')
      .where('id', '=', id)
      .where('active', '=', true)
      .executeTakeFirst() ?? null
  }

  listActiveSeries(brandId: string): Promise<ReferenceVehicleItem[]> {
    return this.db
      .selectFrom('vehicle_series')
      .select(['id', 'name'])
      .where('brand_id', '=', brandId)
      .where('active', '=', true)
      .orderBy('name', 'asc')
      .execute()
  }

  async findActiveSeriesById(id: string): Promise<{ id: string } | null> {
    return await this.db
      .selectFrom('vehicle_series')
      .select('id')
      .where('id', '=', id)
      .where('active', '=', true)
      .executeTakeFirst() ?? null
  }

  listActiveModels(seriesId: string): Promise<ReferenceVehicleItem[]> {
    return this.db
      .selectFrom('vehicle_models')
      .select(['id', 'name'])
      .where('series_id', '=', seriesId)
      .where('active', '=', true)
      .orderBy('name', 'asc')
      .execute()
  }

  async listActiveSelectionModels(seriesId: string): Promise<ActiveVehicleSelectionModel[]> {
    const rows = await this.db
      .selectFrom('vehicle_models')
      .select(['id', 'catalog_key', 'name', 'selection_path'])
      .where('series_id', '=', seriesId)
      .where('active', '=', true)
      .execute()

    return rows.map((row) => ({
      id: row.id,
      catalogKey: row.catalog_key,
      name: row.name,
      selectionPath: row.selection_path,
    }))
  }

  async findModelSummaryById(id: string): Promise<VehicleModelSummaryRow | null> {
    return await this.db
      .selectFrom('vehicle_models')
      .innerJoin('vehicle_series', 'vehicle_series.id', 'vehicle_models.series_id')
      .innerJoin('vehicle_brands', 'vehicle_brands.id', 'vehicle_series.brand_id')
      .select([
        'vehicle_models.id as modelId',
        'vehicle_models.catalog_key as modelCatalogKey',
        'vehicle_models.name as modelName',
        'vehicle_models.selection_path as selectionPath',
        'vehicle_series.id as seriesId',
        'vehicle_series.name as seriesName',
        'vehicle_brands.id as brandId',
        'vehicle_brands.name as brandName',
      ])
      .where('vehicle_models.id', '=', id)
      .executeTakeFirst() ?? null
  }

  async findActiveModelSummaryById(id: string): Promise<VehicleModelSummaryRow | null> {
    return await this.db
      .selectFrom('vehicle_models')
      .innerJoin('vehicle_series', 'vehicle_series.id', 'vehicle_models.series_id')
      .innerJoin('vehicle_brands', 'vehicle_brands.id', 'vehicle_series.brand_id')
      .select([
        'vehicle_models.id as modelId',
        'vehicle_models.catalog_key as modelCatalogKey',
        'vehicle_models.name as modelName',
        'vehicle_models.selection_path as selectionPath',
        'vehicle_series.id as seriesId',
        'vehicle_series.name as seriesName',
        'vehicle_brands.id as brandId',
        'vehicle_brands.name as brandName',
      ])
      .where('vehicle_models.id', '=', id)
      .where('vehicle_models.active', '=', true)
      .where('vehicle_series.active', '=', true)
      .where('vehicle_brands.active', '=', true)
      .executeTakeFirst() ?? null
  }
}
