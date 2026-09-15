import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../../db/client.js'

type ListingDatabase = Kysely<Database> | Transaction<Database>

export interface ListingTypeRow {
  id: string
  code: string
}

export interface OwnedCarDraftRow {
  id: string
  status: string
  listingTypeCode: string
  vehicleModelId: string
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

  async findOwnedCarDraft(ownerUserId: string, listingId: string): Promise<OwnedCarDraftRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .select([
        'listings.id as id',
        'listings.status as status',
        'listing_types.code as listingTypeCode',
        'car_details.vehicle_model_id as vehicleModelId',
      ])
      .where('listings.id', '=', listingId)
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listings.status', '=', 'draft')
      .where('listing_types.code', '=', 'car_sale')
      .executeTakeFirst() ?? null
  }
}
