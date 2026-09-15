import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database } from '../../db/client.js'

type SeedDatabase = Kysely<Database> | Transaction<Database>

export interface DevelopmentCarListingFixture {
  id: string
  vehicleCatalogKey: string
  location: {
    providerCode: string
    provinceSourceKey: string
    districtSourceKey: string
    neighborhoodSourceKey: string
  }
  modelYear: number
  mileageKm: number
  priceAmount: number
  description: string
}

export const DEVELOPMENT_CAR_LISTING_FIXTURES: readonly DevelopmentCarListingFixture[] = [
  {
    id: '0199f000-0000-7000-8000-000000000001',
    vehicleCatalogKey: 'renault:clio:1-0-tce-evolution',
    location: {
      providerCode: 'fixture-tr',
      provinceSourceKey: '34',
      districtSourceKey: '34-gungoren',
      neighborhoodSourceKey: '34-gungoren-haznedar',
    },
    modelYear: 2024,
    mileageKm: 18500,
    priceAmount: 1250000,
    description: 'Geliştirme ortamı için oluşturulmuş örnek Clio ilanı. Bakımlı ve günlük kullanımı temsil eden sahte veridir.',
  },
  {
    id: '0199f000-0000-7000-8000-000000000002',
    vehicleCatalogKey: 'fiat:egea:1-4-fire-easy',
    location: {
      providerCode: 'fixture-tr',
      provinceSourceKey: '34',
      districtSourceKey: '34-sariyer',
      neighborhoodSourceKey: '34-sariyer-maslak',
    },
    modelYear: 2022,
    mileageKm: 62000,
    priceAmount: 850000,
    description: 'Geliştirme ortamı için oluşturulmuş örnek Egea ilanı. Gerçek bir satıcıya veya gerçek araca ait değildir.',
  },
  {
    id: '0199f000-0000-7000-8000-000000000003',
    vehicleCatalogKey: 'hyundai:i20:1-4-mpi-elite',
    location: {
      providerCode: 'fixture-tr',
      provinceSourceKey: '06',
      districtSourceKey: '06-cankaya',
      neighborhoodSourceKey: '06-cankaya-balgat',
    },
    modelYear: 2023,
    mileageKm: 31400,
    priceAmount: 1040000,
    description: 'Geliştirme ortamı için oluşturulmuş örnek i20 ilanı. Liste ve detay ekranı geliştirmesinde kullanılacak sahte veridir.',
  },
]

async function requireOwner(db: SeedDatabase, ownerUserId: string): Promise<void> {
  const result = await sql<{ id: string }>`
    select id from auth."user" where id = ${ownerUserId}::uuid
  `.execute(db)
  if (!result.rows[0]) {
    throw new Error(`Development listing seed owner not found: ${ownerUserId}`)
  }
}

async function requireListingType(db: SeedDatabase): Promise<string> {
  const row = await db
    .selectFrom('listing_types')
    .select('id')
    .where('code', '=', 'car_sale')
    .executeTakeFirst()
  if (!row) throw new Error('Development listing seed requires listing type car_sale')
  return row.id
}

async function requireVehicleModel(db: SeedDatabase, catalogKey: string): Promise<string> {
  const row = await db
    .selectFrom('vehicle_models')
    .innerJoin('vehicle_series', 'vehicle_series.id', 'vehicle_models.series_id')
    .innerJoin('vehicle_brands', 'vehicle_brands.id', 'vehicle_series.brand_id')
    .select('vehicle_models.id as id')
    .where('vehicle_models.catalog_key', '=', catalogKey)
    .where('vehicle_models.active', '=', true)
    .where('vehicle_series.active', '=', true)
    .where('vehicle_brands.active', '=', true)
    .executeTakeFirst()

  if (!row) throw new Error(`Development listing seed vehicle model not found: ${catalogKey}`)
  return row.id
}

async function requireLocation(db: SeedDatabase, fixture: DevelopmentCarListingFixture) {
  const result = await sql<{
    province_id: string
    district_id: string
    neighborhood_id: string
  }>`
    select p.id as province_id, d.id as district_id, n.id as neighborhood_id
    from reference_data_providers provider
    join provinces p on p.provider_id = provider.id
    join districts d on d.provider_id = provider.id and d.province_id = p.id
    join neighborhoods n on n.provider_id = provider.id and n.district_id = d.id
    where provider.code = ${fixture.location.providerCode}
      and p.source_key = ${fixture.location.provinceSourceKey}
      and d.source_key = ${fixture.location.districtSourceKey}
      and n.source_key = ${fixture.location.neighborhoodSourceKey}
      and p.active = true
      and d.active = true
      and n.active = true
  `.execute(db)

  const row = result.rows[0]
  if (!row) {
    throw new Error(`Development listing seed location not found for listing ${fixture.id}`)
  }
  return row
}

export async function seedDevelopmentCarListings(
  db: Kysely<Database>,
  ownerUserId: string,
  runtimeEnvironment = process.env.NODE_ENV,
  fixtures: readonly DevelopmentCarListingFixture[] = DEVELOPMENT_CAR_LISTING_FIXTURES,
): Promise<{ upserted: number; listingIds: string[] }> {
  if (runtimeEnvironment === 'production') {
    throw new Error('Development listing seed is disabled in production')
  }

  await requireOwner(db, ownerUserId)
  const listingIds: string[] = []

  await db.transaction().execute(async (transaction) => {
    const listingTypeId = await requireListingType(transaction)

    for (const fixture of fixtures) {
      const vehicleModelId = await requireVehicleModel(transaction, fixture.vehicleCatalogKey)
      const location = await requireLocation(transaction, fixture)

      await transaction
        .insertInto('listings')
        .values({
          id: fixture.id,
          owner_user_id: ownerUserId,
          listing_type_id: listingTypeId,
          status: 'published',
          description: fixture.description,
          price_amount: String(fixture.priceAmount),
          currency: 'TRY',
          province_id: location.province_id,
          district_id: location.district_id,
          neighborhood_id: location.neighborhood_id,
        })
        .onConflict((conflict) => conflict.column('id').doUpdateSet({
          owner_user_id: ownerUserId,
          listing_type_id: listingTypeId,
          status: 'published',
          description: fixture.description,
          price_amount: String(fixture.priceAmount),
          currency: 'TRY',
          province_id: location.province_id,
          district_id: location.district_id,
          neighborhood_id: location.neighborhood_id,
          updated_at: sql`now()`,
        }))
        .execute()

      await transaction
        .insertInto('car_details')
        .values({
          listing_id: fixture.id,
          vehicle_model_id: vehicleModelId,
          model_year: fixture.modelYear,
          mileage_km: fixture.mileageKm,
        })
        .onConflict((conflict) => conflict.column('listing_id').doUpdateSet({
          vehicle_model_id: vehicleModelId,
          model_year: fixture.modelYear,
          mileage_km: fixture.mileageKm,
        }))
        .execute()

      listingIds.push(fixture.id)
    }
  })

  return { upserted: fixtures.length, listingIds }
}
