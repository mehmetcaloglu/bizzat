import type {
  ApartmentTransactionType,
  PublicApartmentListingSort,
  PublicCarListingSort,
} from '@bizzat/contracts'
import { sql, type Kysely, type RawBuilder, type Transaction } from 'kysely'
import type { Database } from '../../db/client.js'
import type { VehicleSelectionNode } from '../../reference/vehicle/catalog.types.js'

type ListingDatabase = Kysely<Database> | Transaction<Database>

export interface ListingTypeRow {
  id: string
  code: string
}

export interface OwnedCarListingRow {
  id: string
  status: string
  updatedAt: Date
  publishedAt: Date | null
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

export interface OwnerCarListingSummaryRow {
  id: string
  status: string
  title: string | null
  priceAmount: string | null
  currency: string | null
  modelYear: number | null
  mileageKm: number | null
  brandName: string
  seriesName: string
  modelName: string
  provinceName: string | null
  districtName: string | null
  imageId: string | null
  updatedAt: Date
  publishedAt: Date | null
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

export interface PublicCarListingFilters {
  brandId?: string
  seriesId?: string
  modelId?: string
  provinceId?: string
  districtId?: string
  minPrice?: number
  maxPrice?: number
  minYear?: number
  maxYear?: number
  minMileageKm?: number
  maxMileageKm?: number
  fuelType?: string
  transmission?: string
  bodyType?: string
  drivetrain?: string
  vehicleCondition?: string
  color?: string
  q?: string
  swapAvailable?: boolean
  listedWithinDays?: number
}

export interface PublicCarListingCursor {
  sort: PublicCarListingSort
  filterKey: string
  value: string
  id: string
}

export interface PublicCarListingRow {
  id: string
  publishedAtCursor: string
  priceCursor: string
  mileageCursor: string
  yearCursor: string
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

export interface PublicCarListingDetailRow {
  id: string
  title: string | null
  description: string | null
  priceAmount: string | null
  currency: string | null
  modelYear: number | null
  mileageKm: number | null
  brandName: string
  seriesName: string
  modelName: string
  modelCatalogKey: string
  selectionPath: VehicleSelectionNode[] | null
  provinceName: string | null
  districtName: string | null
  neighborhoodName: string | null
  showPhone: boolean
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

export interface PublicListingContactRow {
  phoneE164: string | null
  showPhone: boolean
}

export interface ApartmentListingRow {
  id: string
  listingTypeCode: string
  status: string
  updatedAt: Date
  publishedAt: Date | null
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
  transactionType: string | null
  roomCount: string | null
  grossM2: number | null
  netM2: number | null
  buildingAge: number | null
  floor: number | null
  totalFloors: number | null
  heating: string | null
  bathroomCount: number | null
  kitchen: string | null
  balcony: boolean | null
  elevator: boolean | null
  parking: string | null
  furnished: boolean | null
  occupancy: string | null
  inSite: boolean | null
  deedStatus: string | null
  creditEligible: boolean | null
  swapAvailable: boolean | null
  depositAmount: string | null
  imageId: string | null
}

export interface PublicApartmentListingRow extends ApartmentListingRow {
  publishedAtCursor: string
  priceCursor: string
  grossM2Cursor: string
}

export interface ApartmentOwnerSummaryRow {
  id: string
  listingTypeCode: string
  status: string
  updatedAt: Date
  publishedAt: Date | null
  title: string | null
  priceAmount: string | null
  currency: string | null
  roomCount: string | null
  grossM2: number | null
  provinceName: string | null
  districtName: string | null
  imageId: string | null
}

export interface ApartmentFeedFilters {
  transactionType: ApartmentTransactionType
  provinceId?: string
  districtId?: string
  minPrice?: number
  maxPrice?: number
  roomCount?: string
  minGrossM2?: number
  maxGrossM2?: number
  minBuildingAge?: number
  maxBuildingAge?: number
  minFloor?: number
  maxFloor?: number
  heating?: string
  bathroomCount?: number
  furnished?: boolean
  inSite?: boolean
  parking?: string
  creditEligible?: boolean
  swapAvailable?: boolean
  q?: string
  listedWithinDays?: number
}

export interface PublicApartmentCursor {
  sort: PublicApartmentListingSort
  filterKey: string
  value: string
  id: string
}

function apartmentListingOrder(
  sort: PublicApartmentListingSort,
): { primary: RawBuilder<unknown>; direction: 'asc' | 'desc' } {
  switch (sort) {
    case 'newest':
      return {
        primary: sql`coalesce(listings.published_at, listings.updated_at)`,
        direction: 'desc',
      }
    case 'oldest':
      return {
        primary: sql`coalesce(listings.published_at, listings.updated_at)`,
        direction: 'asc',
      }
    case 'price_asc':
      return { primary: sql`listings.price_amount`, direction: 'asc' }
    case 'price_desc':
      return { primary: sql`listings.price_amount`, direction: 'desc' }
    case 'gross_m2_asc':
      return { primary: sql`apartment_details.gross_m2`, direction: 'asc' }
    case 'gross_m2_desc':
      return { primary: sql`apartment_details.gross_m2`, direction: 'desc' }
  }
}

function apartmentCursorCondition(
  sort: PublicApartmentListingSort,
  cursor: PublicApartmentCursor,
): RawBuilder<boolean> {
  switch (sort) {
    case 'newest':
      return sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at) < ${cursor.value}::timestamptz
        or (
          coalesce(listings.published_at, listings.updated_at) = ${cursor.value}::timestamptz
          and listings.id < ${cursor.id}::uuid
        )
      )`
    case 'oldest':
      return sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at) > ${cursor.value}::timestamptz
        or (
          coalesce(listings.published_at, listings.updated_at) = ${cursor.value}::timestamptz
          and listings.id > ${cursor.id}::uuid
        )
      )`
    case 'price_asc':
      return sql<boolean>`(
        listings.price_amount > ${cursor.value}::numeric
        or (listings.price_amount = ${cursor.value}::numeric and listings.id > ${cursor.id}::uuid)
      )`
    case 'price_desc':
      return sql<boolean>`(
        listings.price_amount < ${cursor.value}::numeric
        or (listings.price_amount = ${cursor.value}::numeric and listings.id < ${cursor.id}::uuid)
      )`
    case 'gross_m2_asc':
      return sql<boolean>`(
        apartment_details.gross_m2 > ${cursor.value}::integer
        or (apartment_details.gross_m2 = ${cursor.value}::integer and listings.id > ${cursor.id}::uuid)
      )`
    case 'gross_m2_desc':
      return sql<boolean>`(
        apartment_details.gross_m2 < ${cursor.value}::integer
        or (apartment_details.gross_m2 = ${cursor.value}::integer and listings.id < ${cursor.id}::uuid)
      )`
  }
}

function publicListingOrder(
  sort: PublicCarListingSort,
): { primary: RawBuilder<unknown>; direction: 'asc' | 'desc' } {
  switch (sort) {
    case 'newest':
      return {
        primary: sql`coalesce(listings.published_at, listings.updated_at)`,
        direction: 'desc',
      }
    case 'oldest':
      return {
        primary: sql`coalesce(listings.published_at, listings.updated_at)`,
        direction: 'asc',
      }
    case 'price_asc':
      return { primary: sql`listings.price_amount`, direction: 'asc' }
    case 'price_desc':
      return { primary: sql`listings.price_amount`, direction: 'desc' }
    case 'mileage_asc':
      return { primary: sql`car_details.mileage_km`, direction: 'asc' }
    case 'mileage_desc':
      return { primary: sql`car_details.mileage_km`, direction: 'desc' }
    case 'year_asc':
      return { primary: sql`car_details.model_year`, direction: 'asc' }
    case 'year_desc':
      return { primary: sql`car_details.model_year`, direction: 'desc' }
  }
}

function cursorCondition(
  sort: PublicCarListingSort,
  cursor: PublicCarListingCursor,
): RawBuilder<boolean> {
  switch (sort) {
    case 'newest':
      return sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at) < ${cursor.value}::timestamptz
        or (
          coalesce(listings.published_at, listings.updated_at) = ${cursor.value}::timestamptz
          and listings.id < ${cursor.id}::uuid
        )
      )`
    case 'oldest':
      return sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at) > ${cursor.value}::timestamptz
        or (
          coalesce(listings.published_at, listings.updated_at) = ${cursor.value}::timestamptz
          and listings.id > ${cursor.id}::uuid
        )
      )`
    case 'price_asc':
      return sql<boolean>`(
        listings.price_amount > ${cursor.value}::numeric
        or (listings.price_amount = ${cursor.value}::numeric and listings.id > ${cursor.id}::uuid)
      )`
    case 'price_desc':
      return sql<boolean>`(
        listings.price_amount < ${cursor.value}::numeric
        or (listings.price_amount = ${cursor.value}::numeric and listings.id < ${cursor.id}::uuid)
      )`
    case 'mileage_asc':
      return sql<boolean>`(
        car_details.mileage_km > ${cursor.value}::integer
        or (car_details.mileage_km = ${cursor.value}::integer and listings.id > ${cursor.id}::uuid)
      )`
    case 'mileage_desc':
      return sql<boolean>`(
        car_details.mileage_km < ${cursor.value}::integer
        or (car_details.mileage_km = ${cursor.value}::integer and listings.id < ${cursor.id}::uuid)
      )`
    case 'year_asc':
      return sql<boolean>`(
        car_details.model_year > ${cursor.value}::integer
        or (car_details.model_year = ${cursor.value}::integer and listings.id > ${cursor.id}::uuid)
      )`
    case 'year_desc':
      return sql<boolean>`(
        car_details.model_year < ${cursor.value}::integer
        or (car_details.model_year = ${cursor.value}::integer and listings.id < ${cursor.id}::uuid)
      )`
  }
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
        'listings.published_at as publishedAt',
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

  async findOwnedApartmentListing(
    ownerUserId: string,
    listingId: string,
  ): Promise<ApartmentListingRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .leftJoin('apartment_details', 'apartment_details.listing_id', 'listings.id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .leftJoin('neighborhoods', 'neighborhoods.id', 'listings.neighborhood_id')
      .select([
        'listings.id as id',
        'listing_types.code as listingTypeCode',
        'listings.status as status',
        'listings.updated_at as updatedAt',
        'listings.published_at as publishedAt',
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
        'apartment_details.transaction_type as transactionType',
        'apartment_details.room_count as roomCount',
        'apartment_details.gross_m2 as grossM2',
        'apartment_details.net_m2 as netM2',
        'apartment_details.building_age as buildingAge',
        'apartment_details.floor as floor',
        'apartment_details.total_floors as totalFloors',
        'apartment_details.heating as heating',
        'apartment_details.bathroom_count as bathroomCount',
        'apartment_details.kitchen as kitchen',
        'apartment_details.balcony as balcony',
        'apartment_details.elevator as elevator',
        'apartment_details.parking as parking',
        'apartment_details.furnished as furnished',
        'apartment_details.occupancy as occupancy',
        'apartment_details.in_site as inSite',
        'apartment_details.deed_status as deedStatus',
        'apartment_details.credit_eligible as creditEligible',
        'apartment_details.swap_available as swapAvailable',
        'apartment_details.deposit_amount as depositAmount',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
      ])
      .where('listings.id', '=', listingId)
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listing_types.code', 'in', ['apartment_sale', 'apartment_rent'])
      .executeTakeFirst() ?? null
  }

  async updateOwnedApartmentCore(input: {
    ownerUserId: string
    listingId: string
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
        price_amount: input.priceAmount,
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
      .where('status', 'in', ['draft', 'published', 'inactive'])
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async upsertApartmentDetails(input: {
    listingId: string
    transactionType: ApartmentTransactionType
    roomCount: string
    grossM2: number
    netM2: number | null
    buildingAge: number | null
    floor: number | null
    totalFloors: number | null
    heating: string
    bathroomCount: number
    kitchen: string
    balcony: boolean
    elevator: boolean
    parking: string
    furnished: boolean
    occupancy: string
    inSite: boolean
    deedStatus: string
    creditEligible: boolean | null
    swapAvailable: boolean | null
    depositAmount: number | null
  }): Promise<void> {
    await this.db
      .insertInto('apartment_details')
      .values({
        listing_id: input.listingId,
        transaction_type: input.transactionType,
        room_count: input.roomCount,
        gross_m2: input.grossM2,
        net_m2: input.netM2,
        building_age: input.buildingAge,
        floor: input.floor,
        total_floors: input.totalFloors,
        heating: input.heating,
        bathroom_count: input.bathroomCount,
        kitchen: input.kitchen,
        balcony: input.balcony,
        elevator: input.elevator,
        parking: input.parking,
        furnished: input.furnished,
        occupancy: input.occupancy,
        in_site: input.inSite,
        deed_status: input.deedStatus,
        credit_eligible: input.creditEligible,
        swap_available: input.swapAvailable,
        deposit_amount: input.depositAmount,
      })
      .onConflict((conflict) => conflict.column('listing_id').doUpdateSet({
        transaction_type: input.transactionType,
        room_count: input.roomCount,
        gross_m2: input.grossM2,
        net_m2: input.netM2,
        building_age: input.buildingAge,
        floor: input.floor,
        total_floors: input.totalFloors,
        heating: input.heating,
        bathroom_count: input.bathroomCount,
        kitchen: input.kitchen,
        balcony: input.balcony,
        elevator: input.elevator,
        parking: input.parking,
        furnished: input.furnished,
        occupancy: input.occupancy,
        in_site: input.inSite,
        deed_status: input.deedStatus,
        credit_eligible: input.creditEligible,
        swap_available: input.swapAvailable,
        deposit_amount: input.depositAmount,
      }))
      .execute()
  }

  async listOwnedApartmentSummaries(ownerUserId: string): Promise<ApartmentOwnerSummaryRow[]> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .leftJoin('apartment_details', 'apartment_details.listing_id', 'listings.id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .select([
        'listings.id as id',
        'listing_types.code as listingTypeCode',
        'listings.status as status',
        'listings.updated_at as updatedAt',
        'listings.published_at as publishedAt',
        'listings.title as title',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'apartment_details.room_count as roomCount',
        'apartment_details.gross_m2 as grossM2',
        'provinces.name as provinceName',
        'districts.name as districtName',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
      ])
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listing_types.code', 'in', ['apartment_sale', 'apartment_rent'])
      .orderBy('listings.updated_at', 'desc')
      .orderBy('listings.id', 'desc')
      .execute()
  }

  async findPublicApartmentById(listingId: string): Promise<ApartmentListingRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('apartment_details', 'apartment_details.listing_id', 'listings.id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .leftJoin('neighborhoods', 'neighborhoods.id', 'listings.neighborhood_id')
      .select([
        'listings.id as id',
        'listing_types.code as listingTypeCode',
        'listings.status as status',
        'listings.updated_at as updatedAt',
        'listings.published_at as publishedAt',
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
        'apartment_details.transaction_type as transactionType',
        'apartment_details.room_count as roomCount',
        'apartment_details.gross_m2 as grossM2',
        'apartment_details.net_m2 as netM2',
        'apartment_details.building_age as buildingAge',
        'apartment_details.floor as floor',
        'apartment_details.total_floors as totalFloors',
        'apartment_details.heating as heating',
        'apartment_details.bathroom_count as bathroomCount',
        'apartment_details.kitchen as kitchen',
        'apartment_details.balcony as balcony',
        'apartment_details.elevator as elevator',
        'apartment_details.parking as parking',
        'apartment_details.furnished as furnished',
        'apartment_details.occupancy as occupancy',
        'apartment_details.in_site as inSite',
        'apartment_details.deed_status as deedStatus',
        'apartment_details.credit_eligible as creditEligible',
        'apartment_details.swap_available as swapAvailable',
        'apartment_details.deposit_amount as depositAmount',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
      ])
      .where('listings.id', '=', listingId)
      .where('listings.status', '=', 'published')
      .where('listing_types.code', 'in', ['apartment_sale', 'apartment_rent'])
      .executeTakeFirst() ?? null
  }

  async findPublicApartmentContact(listingId: string): Promise<PublicListingContactRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .select([
        'listings.contact_phone_e164 as phoneE164',
        'listings.show_phone as showPhone',
      ])
      .where('listings.id', '=', listingId)
      .where('listings.status', '=', 'published')
      .where('listing_types.code', 'in', ['apartment_sale', 'apartment_rent'])
      .executeTakeFirst() ?? null
  }

  async listPublicApartmentListings(
    limit: number,
    options: {
      sort: PublicApartmentListingSort
      filters: ApartmentFeedFilters
      cursor?: PublicApartmentCursor
    },
  ): Promise<PublicApartmentListingRow[]> {
    const { filters, cursor, sort } = options
    let query = this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('apartment_details', 'apartment_details.listing_id', 'listings.id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .leftJoin('neighborhoods', 'neighborhoods.id', 'listings.neighborhood_id')
      .select([
        'listings.id as id',
        'listing_types.code as listingTypeCode',
        'listings.status as status',
        'listings.updated_at as updatedAt',
        'listings.published_at as publishedAt',
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
        'apartment_details.transaction_type as transactionType',
        'apartment_details.room_count as roomCount',
        'apartment_details.gross_m2 as grossM2',
        'apartment_details.net_m2 as netM2',
        'apartment_details.building_age as buildingAge',
        'apartment_details.floor as floor',
        'apartment_details.total_floors as totalFloors',
        'apartment_details.heating as heating',
        'apartment_details.bathroom_count as bathroomCount',
        'apartment_details.kitchen as kitchen',
        'apartment_details.balcony as balcony',
        'apartment_details.elevator as elevator',
        'apartment_details.parking as parking',
        'apartment_details.furnished as furnished',
        'apartment_details.occupancy as occupancy',
        'apartment_details.in_site as inSite',
        'apartment_details.deed_status as deedStatus',
        'apartment_details.credit_eligible as creditEligible',
        'apartment_details.swap_available as swapAvailable',
        'apartment_details.deposit_amount as depositAmount',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
        sql<string>`coalesce(listings.published_at, listings.updated_at)::text`.as('publishedAtCursor'),
        sql<string>`listings.price_amount::text`.as('priceCursor'),
        sql<string>`apartment_details.gross_m2::text`.as('grossM2Cursor'),
      ])
      .where('listings.status', '=', 'published')
      .where('listing_types.code', 'in', ['apartment_sale', 'apartment_rent'])
      .where('apartment_details.transaction_type', '=', filters.transactionType)
      .where(sql<boolean>`listings.price_amount is not null`)
      .where(sql<boolean>`apartment_details.gross_m2 is not null`)

    if (filters.provinceId) query = query.where('listings.province_id', '=', filters.provinceId)
    if (filters.districtId) query = query.where('listings.district_id', '=', filters.districtId)
    if (filters.minPrice !== undefined) {
      query = query.where(sql<boolean>`listings.price_amount >= ${filters.minPrice}::numeric`)
    }
    if (filters.maxPrice !== undefined) {
      query = query.where(sql<boolean>`listings.price_amount <= ${filters.maxPrice}::numeric`)
    }
    if (filters.roomCount) query = query.where('apartment_details.room_count', '=', filters.roomCount)
    if (filters.minGrossM2 !== undefined) {
      query = query.where(sql<boolean>`apartment_details.gross_m2 >= ${filters.minGrossM2}::integer`)
    }
    if (filters.maxGrossM2 !== undefined) {
      query = query.where(sql<boolean>`apartment_details.gross_m2 <= ${filters.maxGrossM2}::integer`)
    }
    if (filters.minBuildingAge !== undefined) {
      query = query.where(sql<boolean>`apartment_details.building_age >= ${filters.minBuildingAge}::integer`)
    }
    if (filters.maxBuildingAge !== undefined) {
      query = query.where(sql<boolean>`apartment_details.building_age <= ${filters.maxBuildingAge}::integer`)
    }
    if (filters.minFloor !== undefined) {
      query = query.where(sql<boolean>`apartment_details.floor >= ${filters.minFloor}::integer`)
    }
    if (filters.maxFloor !== undefined) {
      query = query.where(sql<boolean>`apartment_details.floor <= ${filters.maxFloor}::integer`)
    }
    if (filters.heating) query = query.where('apartment_details.heating', '=', filters.heating)
    if (filters.bathroomCount !== undefined) {
      query = query.where('apartment_details.bathroom_count', '=', filters.bathroomCount)
    }
    if (filters.furnished !== undefined) {
      query = query.where('apartment_details.furnished', '=', filters.furnished)
    }
    if (filters.inSite !== undefined) {
      query = query.where('apartment_details.in_site', '=', filters.inSite)
    }
    if (filters.parking) query = query.where('apartment_details.parking', '=', filters.parking)
    if (filters.creditEligible !== undefined) {
      query = query.where('apartment_details.credit_eligible', '=', filters.creditEligible)
    }
    if (filters.swapAvailable !== undefined) {
      query = query.where('apartment_details.swap_available', '=', filters.swapAvailable)
    }
    if (filters.q) {
      const pattern = `%${filters.q}%`
      query = query.where(sql<boolean>`(
        listings.title ilike ${pattern}
        or listings.description ilike ${pattern}
      )`)
    }
    if (filters.listedWithinDays !== undefined) {
      query = query.where(sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at)
          >= now() - (${filters.listedWithinDays} * interval '1 day')
      )`)
    }
    if (cursor) {
      query = query.where(apartmentCursorCondition(sort, cursor))
    }

    const order = apartmentListingOrder(sort)
    return await query
      .orderBy(order.primary, order.direction)
      .orderBy('listings.id', order.direction)
      .limit(limit)
      .execute()
  }

  async listOwnedCarListings(ownerUserId: string): Promise<OwnerCarListingSummaryRow[]> {
    return await this.db
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
        'listings.status as status',
        'listings.title as title',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'car_details.model_year as modelYear',
        'car_details.mileage_km as mileageKm',
        'vehicle_brands.name as brandName',
        'vehicle_series.name as seriesName',
        'vehicle_models.name as modelName',
        'provinces.name as provinceName',
        'districts.name as districtName',
        sql<string | null>`(
          select li.id::text
          from listing_images li
          where li.listing_id = listings.id
          order by li.sort_order asc, li.created_at asc
          limit 1
        )`.as('imageId'),
        'listings.updated_at as updatedAt',
        'listings.published_at as publishedAt',
      ])
      .where('listings.owner_user_id', '=', ownerUserId)
      .where('listing_types.code', '=', 'car_sale')
      .orderBy('listings.updated_at', 'desc')
      .orderBy('listings.id', 'desc')
      .execute()
  }

  async lockOwnedListingForStatus(
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

  async markListingPendingVerification(
    ownerUserId: string,
    listingId: string,
  ): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        status: 'pending_verification',
        updated_at: sql`now()`,
      })
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .where('status', 'in', ['draft', 'inactive'])
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async publishOwnedListing(
    ownerUserId: string,
    listingId: string,
    publishedAt: Date,
  ): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        status: 'published',
        published_at: publishedAt,
        updated_at: sql`now()`,
      })
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .where('status', '=', 'pending_verification')
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async restoreListingStatus(
    ownerUserId: string,
    listingId: string,
    status: 'draft' | 'inactive',
  ): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        status,
        updated_at: sql`now()`,
      })
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .where('status', '=', 'pending_verification')
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async unpublishOwnedListing(ownerUserId: string, listingId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('listings')
      .set({
        status: 'inactive',
        updated_at: sql`now()`,
      })
      .where('id', '=', listingId)
      .where('owner_user_id', '=', ownerUserId)
      .where('status', '=', 'published')
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
  }

  async insertPendingVerificationCheck(input: {
    listingId: string
    type: string
    provider: string
  }): Promise<{ id: string }> {
    return await this.db
      .insertInto('verification_checks')
      .values({
        listing_id: input.listingId,
        type: input.type,
        provider: input.provider,
        status: 'pending',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  }

  async completeVerificationCheck(input: {
    checkId: string
    status: 'verified' | 'failed' | 'unavailable'
    providerReference: string | null
    failureCode: string | null
    verifiedAt: Date | null
  }): Promise<boolean> {
    const result = await this.db
      .updateTable('verification_checks')
      .set({
        status: input.status,
        provider_reference: input.providerReference,
        failure_code: input.failureCode,
        verified_at: input.verifiedAt,
      })
      .where('id', '=', input.checkId)
      .executeTakeFirst()
    return result.numUpdatedRows === 1n
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
      .where('status', 'in', ['draft', 'published', 'inactive'])
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

  async findPublicCarListingById(listingId: string): Promise<PublicCarListingDetailRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .innerJoin('car_details', 'car_details.listing_id', 'listings.id')
      .innerJoin('vehicle_models', 'vehicle_models.id', 'car_details.vehicle_model_id')
      .innerJoin('vehicle_series', 'vehicle_series.id', 'vehicle_models.series_id')
      .innerJoin('vehicle_brands', 'vehicle_brands.id', 'vehicle_series.brand_id')
      .leftJoin('provinces', 'provinces.id', 'listings.province_id')
      .leftJoin('districts', 'districts.id', 'listings.district_id')
      .leftJoin('neighborhoods', 'neighborhoods.id', 'listings.neighborhood_id')
      .select([
        'listings.id as id',
        'listings.title as title',
        'listings.description as description',
        'listings.price_amount as priceAmount',
        'listings.currency as currency',
        'listings.show_phone as showPhone',
        'car_details.model_year as modelYear',
        'car_details.mileage_km as mileageKm',
        'vehicle_brands.name as brandName',
        'vehicle_series.name as seriesName',
        'vehicle_models.name as modelName',
        'vehicle_models.catalog_key as modelCatalogKey',
        'vehicle_models.selection_path as selectionPath',
        'provinces.name as provinceName',
        'districts.name as districtName',
        'neighborhoods.name as neighborhoodName',
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
      .where('listings.status', '=', 'published')
      .where('listing_types.code', '=', 'car_sale')
      .executeTakeFirst() ?? null
  }

  async listPublicListingImages(
    listingId: string,
  ): Promise<Array<Pick<ListingImageRow, 'id' | 'sortOrder'>>> {
    return await this.db
      .selectFrom('listing_images')
      .select(['id', 'sort_order as sortOrder'])
      .where('listing_id', '=', listingId)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc')
      .execute()
  }

  async findPublicListingContact(listingId: string): Promise<PublicListingContactRow | null> {
    return await this.db
      .selectFrom('listings')
      .innerJoin('listing_types', 'listing_types.id', 'listings.listing_type_id')
      .select([
        'listings.contact_phone_e164 as phoneE164',
        'listings.show_phone as showPhone',
      ])
      .where('listings.id', '=', listingId)
      .where('listings.status', '=', 'published')
      .where('listing_types.code', '=', 'car_sale')
      .executeTakeFirst() ?? null
  }

  async listPublicCarListings(
    limit: number,
    options: {
      sort: PublicCarListingSort
      filters: PublicCarListingFilters
      cursor?: PublicCarListingCursor
    },
  ): Promise<PublicCarListingRow[]> {
    const { filters, cursor, sort } = options
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
        sql<string>`coalesce(listings.published_at, listings.updated_at)::text`.as('publishedAtCursor'),
        sql<string>`listings.price_amount::text`.as('priceCursor'),
        sql<string>`car_details.mileage_km::text`.as('mileageCursor'),
        sql<string>`car_details.model_year::text`.as('yearCursor'),
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
      .where(sql<boolean>`listings.price_amount is not null`)
      .where(sql<boolean>`car_details.mileage_km is not null`)
      .where(sql<boolean>`car_details.model_year is not null`)

    if (filters.brandId) query = query.where('vehicle_brands.id', '=', filters.brandId)
    if (filters.seriesId) query = query.where('vehicle_series.id', '=', filters.seriesId)
    if (filters.modelId) query = query.where('vehicle_models.id', '=', filters.modelId)
    if (filters.provinceId) query = query.where('listings.province_id', '=', filters.provinceId)
    if (filters.districtId) query = query.where('listings.district_id', '=', filters.districtId)
    if (filters.minPrice !== undefined) {
      query = query.where(sql<boolean>`listings.price_amount >= ${filters.minPrice}::numeric`)
    }
    if (filters.maxPrice !== undefined) {
      query = query.where(sql<boolean>`listings.price_amount <= ${filters.maxPrice}::numeric`)
    }
    if (filters.minYear !== undefined) {
      query = query.where(sql<boolean>`car_details.model_year >= ${filters.minYear}::integer`)
    }
    if (filters.maxYear !== undefined) {
      query = query.where(sql<boolean>`car_details.model_year <= ${filters.maxYear}::integer`)
    }
    if (filters.minMileageKm !== undefined) {
      query = query.where(sql<boolean>`car_details.mileage_km >= ${filters.minMileageKm}::integer`)
    }
    if (filters.maxMileageKm !== undefined) {
      query = query.where(sql<boolean>`car_details.mileage_km <= ${filters.maxMileageKm}::integer`)
    }
    if (filters.fuelType) query = query.where('car_details.fuel_type', '=', filters.fuelType)
    if (filters.transmission) {
      query = query.where('car_details.transmission', '=', filters.transmission)
    }
    if (filters.bodyType) query = query.where('car_details.body_type', '=', filters.bodyType)
    if (filters.drivetrain) query = query.where('car_details.drivetrain', '=', filters.drivetrain)
    if (filters.vehicleCondition) {
      query = query.where('car_details.vehicle_condition', '=', filters.vehicleCondition)
    }
    if (filters.color) query = query.where('car_details.color', '=', filters.color)
    if (filters.swapAvailable !== undefined) {
      query = query.where('car_details.swap_available', '=', filters.swapAvailable)
    }
    if (filters.q) {
      const pattern = `%${filters.q}%`
      query = query.where(sql<boolean>`(
        listings.title ilike ${pattern}
        or listings.description ilike ${pattern}
      )`)
    }
    if (filters.listedWithinDays !== undefined) {
      query = query.where(sql<boolean>`(
        coalesce(listings.published_at, listings.updated_at)
          >= now() - (${filters.listedWithinDays} * interval '1 day')
      )`)
    }

    if (cursor) {
      const comparator = cursorCondition(sort, cursor)
      query = query.where(comparator)
    }

    const order = publicListingOrder(sort)
    return await query
      .orderBy(order.primary, order.direction)
      .orderBy('listings.id', order.direction)
      .limit(limit)
      .execute()
  }
}
