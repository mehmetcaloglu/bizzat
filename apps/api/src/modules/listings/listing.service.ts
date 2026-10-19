import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CarSaleDraftResponse,
  PublicCarListingListResponse,
  UpdateCarSaleDraftCoreDetailsRequest,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import type { LocationService } from '../../reference/location.service.js'
import type { VehicleCatalogService } from '../../reference/vehicle/vehicle-catalog.service.js'
import {
  ListingImageValidationError,
  processListingImage,
} from './listing-media.js'
import {
  ListingRepository,
  type ListingImageRow,
  type OwnedCarListingRow,
} from './listing.repository.js'

type CarSaleDraft = CarSaleDraftResponse['listing']
type CarFuelType = NonNullable<CarSaleDraft['attributes']>['fuelType']
type CarTransmission = NonNullable<CarSaleDraft['attributes']>['transmission']
type CarBodyType = NonNullable<CarSaleDraft['attributes']>['bodyType']

function coreDetails(row: OwnedCarListingRow): CarSaleDraft['details'] {
  if (
    row.description === null
    || row.priceAmount === null
    || row.currency !== 'TRY'
    || row.provinceId === null
    || row.provinceName === null
    || row.districtId === null
    || row.districtName === null
    || row.neighborhoodId === null
    || row.neighborhoodName === null
    || row.modelYear === null
    || row.mileageKm === null
  ) {
    return null
  }

  return {
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    priceAmount: Number(row.priceAmount),
    currency: 'TRY',
    description: row.description,
    location: {
      province: { id: row.provinceId, name: row.provinceName },
      district: { id: row.districtId, name: row.districtName },
      neighborhood: { id: row.neighborhoodId, name: row.neighborhoodName },
    },
  }
}

function attributes(row: OwnedCarListingRow): CarSaleDraft['attributes'] {
  if (
    !row.fuelType
    || !row.transmission
    || !row.vehicleCondition
    || !row.bodyType
    || row.enginePowerHp === null
    || row.engineDisplacementCc === null
    || !row.drivetrain
    || !row.color
    || row.underWarranty === null
    || row.heavyDamageRecorded === null
    || !row.plateNationality
    || row.swapAvailable === null
    || !row.paintStatus
    || !row.replacementStatus
  ) return null

  return {
    fuelType: row.fuelType as CarFuelType,
    transmission: row.transmission as CarTransmission,
    vehicleCondition: row.vehicleCondition as NonNullable<CarSaleDraft['attributes']>['vehicleCondition'],
    bodyType: row.bodyType as CarBodyType,
    enginePowerHp: row.enginePowerHp,
    engineDisplacementCc: row.engineDisplacementCc,
    drivetrain: row.drivetrain as NonNullable<CarSaleDraft['attributes']>['drivetrain'],
    color: row.color,
    underWarranty: row.underWarranty,
    heavyDamageRecorded: row.heavyDamageRecorded,
    plateNationality: row.plateNationality as NonNullable<CarSaleDraft['attributes']>['plateNationality'],
    swapAvailable: row.swapAvailable,
    paintStatus: row.paintStatus as NonNullable<CarSaleDraft['attributes']>['paintStatus'],
    replacementStatus: row.replacementStatus as NonNullable<CarSaleDraft['attributes']>['replacementStatus'],
  }
}

function contact(row: OwnedCarListingRow): CarSaleDraft['contact'] {
  if (!row.contactPhoneE164) return null
  return {
    phoneE164: row.contactPhoneE164,
    showPhone: row.showPhone,
  }
}

function imageSummary(listingId: string, image: ListingImageRow): CarSaleDraft['images'][number] {
  return {
    id: image.id,
    sortOrder: image.sortOrder,
    url: `/api/v1/listings/${listingId}/images/${image.id}`,
  }
}

function mediaRoot(): string {
  return path.resolve(process.env.BIZZAT_MEDIA_ROOT ?? '.data/media')
}

export class ListingService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: ListingRepository,
    private readonly vehicleCatalog: VehicleCatalogService,
    private readonly locations: LocationService,
  ) {}

  async createCarSaleDraft(ownerUserId: string, vehicleModelId: string): Promise<CarSaleDraft> {
    const vehicle = await this.vehicleCatalog.findActiveModelSummary(vehicleModelId)
    if (!vehicle) {
      throw new AppError(400, 'VEHICLE_MODEL_NOT_AVAILABLE', 'Seçtiğin araç modeli kullanılamıyor.')
    }

    const listingType = await this.repository.findListingTypeByCode('car_sale')
    if (!listingType) {
      throw new AppError(500, 'INTERNAL_ERROR', 'İlan türü yapılandırması bulunamadı.')
    }

    const listing = await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const created = await repository.insertDraft({
        ownerUserId,
        listingTypeId: listingType.id,
      })
      await repository.insertCarDetail({
        listingId: created.id,
        vehicleModelId,
      })
      return created
    })

    return {
      id: listing.id,
      status: 'draft',
      type: 'car_sale',
      vehicle,
      details: null,
      title: null,
      attributes: null,
      contact: null,
      images: [],
    }
  }

  async getOwnedDraft(ownerUserId: string, listingId: string): Promise<CarSaleDraft> {
    const draft = await this.repository.findOwnedCarListing(ownerUserId, listingId)
    if (!draft || draft.status !== 'draft') {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }

    const vehicle = await this.vehicleCatalog.findModelSummary(draft.vehicleModelId)
    if (!vehicle) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }

    const images = await this.repository.listImages(draft.id)

    return {
      id: draft.id,
      status: 'draft',
      type: 'car_sale',
      vehicle,
      details: coreDetails(draft),
      title: draft.title,
      attributes: attributes(draft),
      contact: contact(draft),
      images: images.map((image) => imageSummary(draft.id, image)),
    }
  }

  async updateCarSaleDraftCoreDetails(
    ownerUserId: string,
    listingId: string,
    input: UpdateCarSaleDraftCoreDetailsRequest,
  ): Promise<CarSaleDraft> {
    const existing = await this.repository.findOwnedCarListing(ownerUserId, listingId)
    if (!existing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    if (existing.status !== 'draft') {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık taslak olarak düzenlenemez.')
    }

    if (input.modelYear > new Date().getFullYear() + 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Model yılı geçerli değil.')
    }

    const description = input.description.trim()
    if (description.length < 20) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Açıklama en az 20 karakter olmalı.')
    }

    const title = input.title === undefined ? existing.title : input.title.trim()
    if (title !== null && title.length < 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'İlan başlığı en az 10 karakter olmalı.')
    }

    const color = input.color === undefined ? existing.color : input.color.trim()
    const phone = input.contactPhoneE164 === undefined
      ? existing.contactPhoneE164
      : input.contactPhoneE164.trim()

    const location = await this.locations.resolveActivePath({
      provinceId: input.provinceId,
      districtId: input.districtId,
      neighborhoodId: input.neighborhoodId,
    })
    if (!location) {
      throw new AppError(400, 'LISTING_LOCATION_INVALID', 'Seçtiğin konum artık kullanılamıyor.')
    }

    await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const listingUpdated = await repository.updateOwnedDraftCommonDetails({
        listingId,
        ownerUserId,
        title,
        description,
        priceAmount: input.priceAmount,
        provinceId: input.provinceId,
        districtId: input.districtId,
        neighborhoodId: input.neighborhoodId,
        contactPhoneE164: phone,
        showPhone: input.showPhone ?? existing.showPhone,
      })
      if (!listingUpdated) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık taslak olarak düzenlenemez.')
      }

      const detailsUpdated = await repository.updateCarDetails({
        listingId,
        modelYear: input.modelYear,
        mileageKm: input.mileageKm,
        fuelType: input.fuelType ?? existing.fuelType,
        transmission: input.transmission ?? existing.transmission,
        bodyType: input.bodyType ?? existing.bodyType,
        vehicleCondition: input.vehicleCondition ?? existing.vehicleCondition,
        enginePowerHp: input.enginePowerHp ?? existing.enginePowerHp,
        engineDisplacementCc: input.engineDisplacementCc ?? existing.engineDisplacementCc,
        drivetrain: input.drivetrain ?? existing.drivetrain,
        color,
        underWarranty: input.underWarranty ?? existing.underWarranty,
        heavyDamageRecorded: input.heavyDamageRecorded ?? existing.heavyDamageRecorded,
        plateNationality: input.plateNationality ?? existing.plateNationality,
        swapAvailable: input.swapAvailable ?? existing.swapAvailable,
        paintStatus: input.paintStatus ?? existing.paintStatus,
        replacementStatus: input.replacementStatus ?? existing.replacementStatus,
      })
      if (!detailsUpdated) {
        throw new AppError(500, 'INTERNAL_ERROR', 'İlan detayları güncellenemedi.')
      }
    })

    return this.getOwnedDraft(ownerUserId, listingId)
  }

  async uploadDraftImage(
    ownerUserId: string,
    listingId: string,
    mimeType: string,
    bytes: Buffer,
  ): Promise<CarSaleDraft> {
    let processed
    try {
      processed = await processListingImage(bytes, mimeType)
    } catch (error) {
      if (error instanceof ListingImageValidationError) {
        throw new AppError(400, 'VALIDATION_ERROR', error.message)
      }
      throw error
    }

    const imageId = randomUUID()
    const storageKey = `private/${listingId}/${imageId}/full.webp`
    const cardStorageKey = `private/${listingId}/${imageId}/card.webp`
    const fullPath = path.join(mediaRoot(), storageKey)
    const cardPath = path.join(mediaRoot(), cardStorageKey)

    await mkdir(path.dirname(fullPath), { recursive: true })
    await Promise.all([
      writeFile(fullPath, processed.full),
      writeFile(cardPath, processed.card),
    ])

    try {
      await this.db.transaction().execute(async (transaction) => {
        const repository = new ListingRepository(transaction)
        const locked = await repository.lockOwnedListingForImage(ownerUserId, listingId)
        if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
        if (locked.status !== 'draft') {
          throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilana artık fotoğraf eklenemez.')
        }

        const imageCount = await repository.countImages(listingId)
        if (imageCount >= 10) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Bir ilana en fazla 10 fotoğraf ekleyebilirsin.')
        }

        await repository.insertImage({
          id: imageId,
          listingId,
          storageKey,
          cardStorageKey,
          sortOrder: imageCount,
          sizeBytes: processed.full.length,
          width: processed.width,
          height: processed.height,
        })
      })
    } catch (error) {
      await Promise.all([
        unlink(fullPath).catch(() => undefined),
        unlink(cardPath).catch(() => undefined),
      ])
      throw error
    }

    return this.getOwnedDraft(ownerUserId, listingId)
  }

  async readOwnedImage(ownerUserId: string, listingId: string, imageId: string) {
    const image = await this.repository.findOwnedImage(ownerUserId, listingId, imageId)
    if (!image) throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    try {
      return { mimeType: image.mimeType, bytes: await readFile(path.join(mediaRoot(), image.storageKey)) }
    } catch {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    }
  }

  async readPublicImage(imageId: string) {
    const image = await this.repository.findPublicImage(imageId)
    if (!image) throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    try {
      return { mimeType: image.mimeType, bytes: await readFile(path.join(mediaRoot(), image.cardStorageKey)) }
    } catch {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    }
  }

  async listPublicCarListings(limit: number): Promise<PublicCarListingListResponse> {
    const rows = await this.repository.listPublicCarListings(limit)
    return {
      items: rows.flatMap((row) => {
        if (
          row.title === null
          || row.priceAmount === null
          || row.currency !== 'TRY'
          || row.modelYear === null
          || row.mileageKm === null
          || row.provinceName === null
          || row.districtName === null
          || row.fuelType === null
          || row.transmission === null
          || row.vehicleCondition === null
          || row.bodyType === null
          || row.enginePowerHp === null
          || row.engineDisplacementCc === null
          || row.drivetrain === null
          || row.color === null
          || row.underWarranty === null
          || row.heavyDamageRecorded === null
          || row.plateNationality === null
          || row.swapAvailable === null
          || row.paintStatus === null
          || row.replacementStatus === null
        ) return []

        return [{
          id: row.id,
          title: row.title,
          priceAmount: Number(row.priceAmount),
          currency: 'TRY' as const,
          modelYear: row.modelYear,
          mileageKm: row.mileageKm,
          vehicle: {
            brandName: row.brandName,
            seriesName: row.seriesName,
          },
          location: {
            provinceName: row.provinceName,
            districtName: row.districtName,
          },
          attributes: {
            fuelType: row.fuelType as CarFuelType,
            transmission: row.transmission as CarTransmission,
            vehicleCondition: row.vehicleCondition as NonNullable<CarSaleDraft['attributes']>['vehicleCondition'],
            bodyType: row.bodyType as CarBodyType,
            enginePowerHp: row.enginePowerHp,
            engineDisplacementCc: row.engineDisplacementCc,
            drivetrain: row.drivetrain as NonNullable<CarSaleDraft['attributes']>['drivetrain'],
            color: row.color,
            underWarranty: row.underWarranty,
            heavyDamageRecorded: row.heavyDamageRecorded,
            plateNationality: row.plateNationality as NonNullable<CarSaleDraft['attributes']>['plateNationality'],
            swapAvailable: row.swapAvailable,
            paintStatus: row.paintStatus as NonNullable<CarSaleDraft['attributes']>['paintStatus'],
            replacementStatus: row.replacementStatus as NonNullable<CarSaleDraft['attributes']>['replacementStatus'],
          },
          imageUrl: row.imageId ? `/api/v1/listings/public/images/${row.imageId}` : null,
        }]
      }),
    }
  }
}
