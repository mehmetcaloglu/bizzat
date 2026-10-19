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
  title: string | null
  description: string | null
  priceAmount: string | null
  currency: string | null
  provinceId: string | null
  provinceName: string | null
  districtId: string | null
  districtName: string | null
  neighborhoodId: string | null
  neighborhoodName: string | null
  contactPhoneE164: string | null
  showPhone: boolean
  modelYear: number | null
  mileageKm: number | null
  fuelType: string | null
  transmission: string | null
  bodyType: string | null
  vehicleCondition: string | null
  enginePowerHp: number | null
  engineDisplacementCc: number | null
  drivetrain: string | null
  color: string | null
  underWarranty: boolean | null
  heavyDamageRecorded: boolean | null
  plateNationality: string | null
  swapAvailable: boolean | null
  paintStatus: string | null
  replacementStatus: string | null
}

export interface ListingImageRow {
  id: string
  storageKey: string
  cardStorageKey: string
  sortOrder: number
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}

export interface PublicCarListingRow {
  id: string
  updatedAtCursor: string
  title: string | null
  priceAmount: string | null
  currency: string | null
  modelYear: number | null
  mileageKm: number | null
  brandName: string
  seriesName: string
  provinceName: string | null
  districtName: string | null
  fuelType: string | null
  transmission: string | null
  bodyType: string | null
  vehicleCondition: string | null
  enginePowerHp: number | null
  engineDisplacementCc: number | null
  drivetrain: string | null
  color: string | null
  underWarranty: boolean | null
  heavyDamageRecorded: boolean | null
  plateNationality: string | null
  swapAvailable: boolean | null
  paintStatus: string | null
  replacementStatus: string | null
  imageId: string | null
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
        'listings.updated_at as updatedAt',
        'listings.status as status',
        'listing_types.code as listingTypeCode',
        'car_details.vehicle_model_id as vehicleModelId',
        'listings.title as title',
        'listings.description as description',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'listings.province_id as provinceId',
        'provinces.name as provinceName',
        'listings.district_id as districtId',
        'districts.name as districtName',
        'listings.neighborhood_id as neighborhoodId',
        'neighborhoods.name as neighborhoodName',
        'listings.contact_phone_e164 as contactPhoneE164',
        'listings.show_phone as showPhone',
        'car_details.model_year as modelYear',
        'car_details.mileage_km as mileageKm',
        'car_details.fuel_type as fuelType',
        'car_details.transmission as transmission',
        'car_details.body_type as bodyType',
        'car_details.vehicle_condition as vehicleCondition',
        'car_details.engine_power_hp as enginePowerHp',
        'car_details.engine_displacement_cc as engineDisplacementCc',
        'car_details.drivetrain as drivetrain',
        'car_details.color as color',
        'car_details.under_warranty as underWarranty',
        'car_details.heavy_damage_recorded as heavyDamageRecorded',
        'car_details.plate_nationality as plateNationality',
        'car_details.swap_available as swapAvailable',
        'car_details.paint_status as paintStatus',
        'car_details.replacement_status as replacementStatus',
      ])
      .where('listings.id', '=', listingId)
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listing_types.code', '=', 'car_sale')
      .executeTakeFirst() ?? null
  }

  async updateOwnedDraftCommonDetails(input: {
    listingId: string
    ownerUserId: string
    title: string | null
    description: string
    priceAmount: number
    provinceId: string
    districtId: string
    neighborhoodId: string
    contactPhoneE164: string | null
    showPhone: boolean
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        title: input.title,
        description: input.description,
        price_amount: String(input.priceAmount),
        currency: 'TRY',
        province_id: input.provinceId,
        district_id: input.districtId,
        neighborhood_id: input.neighborhoodId,
        contact_phone_e164: input.contactPhoneE164,
        show_phone: input.showPhone,
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
    fuelType: string | null
    transmission: string | null
    bodyType: string | null
    vehicleCondition: string | null
    enginePowerHp: number | null
    engineDisplacementCc: number | null
    drivetrain: string | null
    color: string | null
    underWarranty: boolean | null
    heavyDamageRecorded: boolean | null
    plateNationality: string | null
    swapAvailable: boolean | null
    paintStatus: string | null
    replacementStatus: string | null
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('car_details')
      .set({
        model_year: input.modelYear,
        mileage_km: input.mileageKm,
        fuel_type: input.fuelType,
        transmission: input.transmission,
        body_type: input.bodyType,
        vehicle_condition: input.vehicleCondition,
        engine_power_hp: input.enginePowerHp,
        engine_displacement_cc: input.engineDisplacementCc,
        drivetrain: input.drivetrain,
        color: input.color,
        under_warranty: input.underWarranty,
        heavy_damage_recorded: input.heavyDamageRecorded,
        plate_nationality: input.plateNationality,
        swap_available: input.swapAvailable,
        paint_status: input.paintStatus,
        replacement_status: input.replacementStatus,
      })
      .where('listing_id', '=', input.listingId)
      .executeTakeFirst()

    return result.numUpdatedRows === 1n
  }

  async lockOwnedListingForImage(
    ownerUserId: string,
    listingId: string,
  ): Promise<{ status: string } | null> {
    return await this.db
      .selectFrom('listings')
      .select('status')
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .forUpdate()
      .executeTakeFirst() ?? null
  }

  async countImages(listingId: string): Promise<number> {
    const row = await this.db
      .selectFrom('listing_images')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('listing_id', '=', listingId)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async insertImage(input: {
    id: string
    listingId: string
    storageKey: string
    cardStorageKey: string
    sortOrder: number
    sizeBytes: number
    width: number
    height: number
  }): Promise<void> {
    await this.db.insertInto('listing_images').values({
      id: input.id,
      listing_id: input.listingId,
      storage_key: input.storageKey,
      card_storage_key: input.cardStorageKey,
      sort_order: input.sortOrder,
      mime_type: 'image/webp',
      size_bytes: input.sizeBytes,
      width: input.width,
      height: input.height,
    }).execute()
  }

  async deleteImage(listingId: string, imageId: string): Promise<ListingImageRow | null> {
    return await this.db
      .deleteFrom('listing_images')
      .where('listing_id', '=', listingId)
      .where('id', '=', imageId)
      .returning([
        'id',
        'storage_key as storageKey',
        'card_storage_key as cardStorageKey',
        'sort_order as sortOrder',
        'mime_type as mimeType',
        'size_bytes as sizeBytes',
        'width',
        'height',
      ])
      .executeTakeFirst() ?? null
  }

  async compactImageOrder(listingId: string, removedSortOrder: number): Promise<void> {
    await this.db
      .updateTable('listing_images')
      .set({ sort_order: sql`sort_order - 1` })
      .where('listing_id', '=', listingId)
      .where('sort_order', '>', removedSortOrder)
      .execute()
  }

  async makeImageCover(listingId: string, imageId: string): Promise<boolean> {
    const image = await this.db
      .selectFrom('listing_images')
      .select(['id', 'sort_order as sortOrder'])
      .where('listing_id', '=', listingId)
      .where('id', '=', imageId)
      .executeTakeFirst()

    if (!image) return false
    if (image.sortOrder === 0) return true

    await this.db
      .updateTable('listing_images')
      .set({ sort_order: sql`sort_order + 1` })
      .where('listing_id', '=', listingId)
      .where('sort_order', '<', image.sortOrder)
      .execute()

    await this.db
      .updateTable('listing_images')
      .set({ sort_order: 0 })
      .where('id', '=', imageId)
      .execute()

    return true
  }

  async listImages(listingId: string): Promise<ListingImageRow[]> {
    return await this.db
      .selectFrom('listing_images')
      .select([
        'id',
        'storage_key as storageKey',
        'card_storage_key as cardStorageKey',
        'sort_order as sortOrder',
        'mime_type as mimeType',
        'size_bytes as sizeBytes',
        'width',
        'height',
      ])
      .where('listing_id', '=', listingId)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc')
      .execute()
  }

  async findOwnedImage(
    ownerUserId: string,
    listingId: string,
    imageId: string,
  ): Promise<ListingImageRow | null> {
    return await this.db
      .selectFrom('listing_images')
      .innerJoin('listings', 'listings.id', 'listing_images.listing_id')
      .select([
        'listing_images.id as id',
        'listing_images.storage_key as storageKey',
        'listing_images.card_storage_key as cardStorageKey',
        'listing_images.sort_order as sortOrder',
        'listing_images.mime_type as mimeType',
        'listing_images.size_bytes as sizeBytes',
        'listing_images.width as width',
        'listing_images.height as height',
      ])
      .where('listing_images.id', '=', imageId)
      .where('listing_images.listing_id', '=', listingId)
      .where('listings.owner_user_id', '=', ownerUserId)
      .executeTakeFirst() ?? null
  }

  async findPublicImage(imageId: string): Promise<ListingImageRow | null> {
    return await this.db
      .selectFrom('listing_images')
      .innerJoin('listings', 'listings.id', 'listing_images.listing_id')
      .select([
        'listing_images.id as id',
        'listing_images.storage_key as storageKey',
        'listing_images.card_storage_key as cardStorageKey',
        'listing_images.sort_order as sortOrder',
        'listing_images.mime_type as mimeType',
        'listing_images.size_bytes as sizeBytes',
        'listing_images.width as width',
        'listing_images.height as height',
      ])
      .where('listing_images.id', '=', imageId)
      .where('listings.status', '=', 'published')
      .executeTakeFirst() ?? null
  }

  async listPublicCarListings(
    limit: number,
    cursor?: { updatedAtCursor: string; id: string },
  ): Promise<PublicCarListingRow[]> {
    let query = this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .innerJoin('vehicle_models', 'vehicle_models.id', 'car_details.vehicle_model_id')
      .innerJoin('vehicle_series', 'vehicle_series.id', 'vehicle_models.series_id')
      .innerJoin('vehicle_brands', 'vehicle_brands.id', 'vehicle_series.brand_id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .select([
        'listings.id as id',
        sql<string>`listings.updated_at::text`.as('updatedAtCursor'),
        'listings.title as title',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'car_details.model_year as modelYear',
        'car_details.mileage_km as mileageKm',
        'vehicle_brands.name as brandName',
        'vehicle_series.name as seriesName',
        'provinces.name as provinceName',
        'districts.name as districtName',
        'car_details.fuel_type as fuelType',
        'car_details.transmission as transmission',
        'car_details.body_type as bodyType',
        'car_details.vehicle_condition as vehicleCondition',
        'car_details.engine_power_hp as enginePowerHp',
        'car_details.engine_displacement_cc as engineDisplacementCc',
        'car_details.drivetrain as drivetrain',
        'car_details.color as color',
        'car_details.under_warranty as underWarranty',
        'car_details.heavy_damage_recorded as heavyDamageRecorded',
        'car_details.plate_nationality as plateNationality',
        'car_details.swap_available as swapAvailable',
        'car_details.paint_status as paintStatus',
        'car_details.replacement_status as replacementStatus',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
      ])
      .where('listings.status', '=', 'published')
      .where('listing_types.code', '=', 'car_sale')

    if (cursor) {
      query = query.where(sql<boolean>`(
        listings.updated_at < ${cursor.updatedAtCursor}::timestamptz
        or (
          listings.updated_at = ${cursor.updatedAtCursor}::timestamptz
          and listings.id < ${cursor.id}::uuid
        )
      )`)
    }

    return await query
      .orderBy('listings.updated_at', 'desc')
      .orderBy('listings.id', 'desc')
      .limit(limit)
      .execute()
  }
}
