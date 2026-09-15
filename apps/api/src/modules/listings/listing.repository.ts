import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database } from '../../db/client.js'

type ListingDatabase = Kysely<Database> | Transaction<Database>

export interface ListingTypeRow {
  id: string
  code: string
}

export interface OwnedCarListingRow {
  id: string
  status: string
  listingTypeCode: string
  vehicleModelId: string
  description: string | null
  priceAmount: string | null
  currency: string | null
  provinceId: string | null
  provinceName: string | null
  districtId: string | null
  districtName: string | null
  neighborhoodId: string | null
  neighborhoodName: string | null
  modelYear: number | null
  mileageKm: number | null
}

export class ListingRepository {
  constructor(private readonly db: ListingDatabase) {}

  async findListingTypeByCode(code: string): Promise<ListingTypeRow | null> {
    return await this.db
      .selectFrom('listing_types')
      .select(['id', 'code'])
      .where('code', '=', code)
      .executeTakeFirst() ?? null
  }

  async insertDraft(input: {
    ownerUserId: string
    listingTypeId: string
  }): Promise<{ id: string }> {
    return this.db
      .insertInto('listings')
      .values({
        owner_user_id: input.ownerUserId,
        listing_type_id: input.listingTypeId,
        status: 'draft',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  }

  async insertCarDetail(input: {
    listingId: string
    vehicleModelId: string
  }): Promise<void> {
    await this.db
      .insertInto('car_details')
      .values({
        listing_id: input.listingId,
        vehicle_model_id: input.vehicleModelId,
      })
      .execute()
  }

  async findOwnedCarListing(ownerUserId: string, listingId: string): Promise<OwnedCarListingRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .leftJoin('neighborhoods', 'neighborhoods.id', 'listings.neighborhood_id')
      .select([
        'listings.id as id',
        'listings.status as status',
        'listing_types.code as listingTypeCode',
        'car_details.vehicle_model_id as vehicleModelId',
        'listings.description as description',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'listings.province_id as provinceId',
        'provinces.name as provinceName',
        'listings.district_id as districtId',
        'districts.name as districtName',
        'listings.neighborhood_id as neighborhoodId',
        'neighborhoods.name as neighborhoodName',
        'car_details.model_year as modelYear',
        'car_details.mileage_km as mileageKm',
      ])
      .where('listings.id', '=', listingId)
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listing_types.code', '=', 'car_sale')
      .executeTakeFirst() ?? null
  }

  async updateOwnedDraftCommonDetails(input: {
    listingId: string
    ownerUserId: string
    description: string
    priceAmount: number
    provinceId: string
    districtId: string
    neighborhoodId: string
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        description: input.description,
        price_amount: String(input.priceAmount),
        currency: 'TRY',
        province_id: input.provinceId,
        district_id: input.districtId,
        neighborhood_id: input.neighborhoodId,
        updated_at: sql`now()`,
      })
      .where('id', '=', input.listingId)
      .where('owner_user_id', '=', input.ownerUserId)
      .where('status', '=', 'draft')
      .executeTakeFirst()

    return result.numUpdatedRows === 1n
  }

  async updateCarDetails(input: {
    listingId: string
    modelYear: number
    mileageKm: number
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('car_details')
      .set({
        model_year: input.modelYear,
        mileage_km: input.mileageKm,
      })
      .where('listing_id', '=', input.listingId)
      .executeTakeFirst()

    return result.numUpdatedRows === 1n
  }
}
