import type { Kysely } from 'kysely'
import type { Database } from '../../db/client.js'

export interface ReferenceVehicleItem {
  id: string
  name: string
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
}
