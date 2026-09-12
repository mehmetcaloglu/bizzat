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
}
