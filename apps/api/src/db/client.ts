import { type Generated, Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

export type UserRole = 'user' | 'moderator' | 'admin'

export interface ProfilesTable {
  user_id: string
  role: UserRole
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface ReferenceDataProvidersTable {
  id: Generated<string>
  code: string
  source_name: string
  source_url: string | null
  license: string | null
  created_at: Generated<Date>
}

export interface ReferenceDataImportsTable {
  id: Generated<string>
  provider_id: string
  version: string
  checksum_sha256: string
  imported_at: Generated<Date>
}

export interface ProvincesTable {
  id: Generated<string>
  provider_id: string
  source_key: string
  code: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface DistrictsTable {
  id: Generated<string>
  provider_id: string
  source_key: string
  province_id: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface NeighborhoodsTable {
  id: Generated<string>
  provider_id: string
  source_key: string
  district_id: string
  name: string
  kind: string | null
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleBrandsTable {
  id: Generated<string>
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleSeriesTable {
  id: Generated<string>
  brand_id: string
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleModelsTable {
  id: Generated<string>
  series_id: string
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface Database {
  profiles: ProfilesTable
  reference_data_providers: ReferenceDataProvidersTable
  reference_data_imports: ReferenceDataImportsTable
  provinces: ProvincesTable
  districts: DistrictsTable
  neighborhoods: NeighborhoodsTable
  vehicle_brands: VehicleBrandsTable
  vehicle_series: VehicleSeriesTable
  vehicle_models: VehicleModelsTable
}

export function createDatabase(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 30000,
      }),
    }),
  })
}
