import { type Generated, Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

export type UserRole = 'user' | 'moderator' | 'admin'
export type VehicleMappingMethod = 'manual' | 'exact-rule' | 'curated-import'

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

export interface VehicleSourceProvidersTable {
  id: Generated<string>
  code: string
  source_name: string
  source_url: string | null
  license: string | null
  created_at: Generated<Date>
}

export interface VehicleSourceImportsTable {
  id: Generated<string>
  provider_id: string
  version: string
  checksum_sha256: string
  imported_at: Generated<Date>
}

export interface VehicleSourceRecordsTable {
  id: Generated<string>
  provider_id: string
  source_key: string
  brand_raw: string
  type_raw: string
  available_model_years: number[]
  active: Generated<boolean>
  mapping_needs_review: Generated<boolean>
  first_seen_import_id: string
  last_seen_import_id: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleSourceMappingsTable {
  source_record_id: string
  vehicle_model_id: string
  mapping_method: VehicleMappingMethod
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
  vehicle_source_providers: VehicleSourceProvidersTable
  vehicle_source_imports: VehicleSourceImportsTable
  vehicle_source_records: VehicleSourceRecordsTable
  vehicle_source_mappings: VehicleSourceMappingsTable
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
