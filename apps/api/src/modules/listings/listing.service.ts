import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CarSaleDraftResponse,
  OwnerCarListingListResponse,
  PublicCarListingContactResponse,
  PublicCarListingDetailResponse,
  PublicCarListingListResponse,
  PublicCarListingSort,
  PublishCarSaleDraftResponse,
  UnpublishCarSaleDraftResponse,
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
import type {
  VerificationOutcome,
  VerificationProvider,
} from '../verifications/verification.provider.js'
import {
  ListingRepository,
  type ListingImageRow,
  type OwnedCarListingRow,
  type OwnerCarListingSummaryRow,
  type PublicCarListingCursor,
  type PublicCarListingFilters,
  type PublicCarListingRow,
} from './listing.repository.js'

type CarSaleDraft = CarSaleDraftResponse['listing']
type CarFuelType = NonNullable<CarSaleDraft['attributes']>['fuelType']
type CarTransmission = NonNullable<CarSaleDraft['attributes']>['transmission']
type CarBodyType = NonNullable<CarSaleDraft['attributes']>['bodyType']
type CarAttributesSource = Pick<
  OwnedCarListingRow,
  | 'fuelType'
  | 'transmission'
  | 'vehicleCondition'
  | 'bodyType'
  | 'enginePowerHp'
  | 'engineDisplacementCc'
  | 'drivetrain'
  | 'color'
  | 'underWarranty'
  | 'heavyDamageRecorded'
  | 'plateNationality'
  | 'swapAvailable'
  | 'paintStatus'
  | 'replacementStatus'
>

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

function attributes(row: CarAttributesSource): CarSaleDraft['attributes'] {
  if (
    !row.fuelType
    || !row.transmission
    || !row.vehicleCondition
    || !row.bodyType
    || row.enginePowerHp === null
    || (row.fuelType !== 'elektrik' && row.engineDisplacementCc === null)
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

function ownerListingSummary(
  row: OwnerCarListingSummaryRow,
): OwnerCarListingListResponse['items'][number] {
  return {
    id: row.id,
    type: 'car_sale',
    status: row.status as OwnerCarListingListResponse['items'][number]['status'],
    title: row.title,
    priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
    currency: row.currency === 'TRY' ? 'TRY' : null,
    modelYear: row.modelYear,
    mileageKm: row.mileageKm,
    vehicle: {
      brandName: row.brandName,
      seriesName: row.seriesName,
      modelName: row.modelName,
    },
    location: {
      provinceName: row.provinceName,
      districtName: row.districtName,
    },
    imageUrl: row.imageId
      ? `/api/v1/listings/${row.id}/images/${row.imageId}`
      : null,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }
}

function mediaRoot(): string {
  return path.resolve(process.env.BIZZAT_MEDIA_ROOT ?? '.data/media')
}

const publicCarSorts: PublicCarListingSort[] = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'mileage_desc',
  'year_asc',
  'year_desc',
]

function publicFiltersKey(filters: PublicCarListingFilters): string {
  return JSON.stringify(
    Object.entries(filters).sort(([left], [right]) => left.localeCompare(right)),
  )
}

function encodePublicCursor(cursor: PublicCarListingCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodePublicCursor(cursor: string): PublicCarListingCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('sort' in parsed)
      || !('filterKey' in parsed)
      || !('value' in parsed)
      || !('id' in parsed)
    ) {
      throw new Error('invalid cursor')
    }
    const { sort, filterKey, value, id } = parsed as Record<string, unknown>
    if (
      typeof sort !== 'string'
      || !publicCarSorts.includes(sort as PublicCarListingSort)
      || typeof filterKey !== 'string'
      || typeof value !== 'string'
      || value.length === 0
      || typeof id !== 'string'
      || id.length === 0
    ) {
      throw new Error('invalid cursor')
    }
    return { sort: sort as PublicCarListingSort, filterKey, value, id }
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Liste devam bilgisi geçersiz.')
  }
}

function cursorValue(row: PublicCarListingRow, sort: PublicCarListingSort): string {
  switch (sort) {
    case 'newest':
    case 'oldest':
      return row.publishedAtCursor
    case 'price_asc':
    case 'price_desc':
      return row.priceCursor
    case 'mileage_asc':
    case 'mileage_desc':
      return row.mileageCursor
    case 'year_asc':
    case 'year_desc':
      return row.yearCursor
  }
}

export interface PublicCarListingQuery {
  limit: number
  cursor?: string
  sort: PublicCarListingSort
  filters: PublicCarListingFilters
}

function assertRange(
  min: number | undefined,
  max: number | undefined,
  label: string,
): void {
  if (min !== undefined && max !== undefined && min > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} alt sınırı üst sınırından büyük olamaz.`)
  }
}

export class ListingService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: ListingRepository,
    private readonly vehicleCatalog: VehicleCatalogService,
    private readonly locations: LocationService,
    private readonly verificationProvider: VerificationProvider,
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

  async listMyCarListings(ownerUserId: string): Promise<OwnerCarListingListResponse> {
    const rows = await this.repository.listOwnedCarListings(ownerUserId)
    return {
      items: rows.map((row) => ownerListingSummary(row)),
    }
  }

  async publishCarSaleListing(
    ownerUserId: string,
    listingId: string,
  ): Promise<PublishCarSaleDraftResponse> {
    const existing = await this.repository.findOwnedCarListing(ownerUserId, listingId)
    if (!existing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    if (existing.status !== 'draft' && existing.status !== 'inactive') {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
    }

    const verifiedInput = await this.assertPublishable(existing)
    const originalStatus = existing.status

    const pendingCheck = await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const locked = await repository.lockOwnedListingForStatus(ownerUserId, listingId)
      if (!locked) {
        throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      }
      if (locked.status !== 'draft' && locked.status !== 'inactive') {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
      }
      if (!await repository.markListingPendingVerification(ownerUserId, listingId)) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
      }
      return await repository.insertPendingVerificationCheck({
        listingId,
        type: 'vehicle_authority',
        provider: this.verificationProvider.name,
      })
    })

    let outcome: VerificationOutcome
    try {
      outcome = await this.verificationProvider.verifyVehicleAuthority({
        listingId,
        ownerUserId,
        vehicleModelId: existing.vehicleModelId,
        modelYear: verifiedInput.modelYear,
        plateNationality: verifiedInput.plateNationality,
      })
    } catch {
      outcome = {
        status: 'unavailable',
        failureCode: 'VERIFICATION_PROVIDER_ERROR',
      }
    }

    const verifiedAt = outcome.status === 'verified' ? new Date() : null

    await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const completed = await repository.completeVerificationCheck({
        checkId: pendingCheck.id,
        status: outcome.status,
        providerReference: outcome.status === 'verified' ? outcome.providerReference : null,
        failureCode: outcome.status === 'verified' ? null : outcome.failureCode,
        verifiedAt,
      })
      if (!completed) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Doğrulama sonucu kaydedilemedi.')
      }

      if (outcome.status === 'verified' && verifiedAt) {
        if (!await repository.publishOwnedListing(ownerUserId, listingId, verifiedAt)) {
          throw new AppError(409, 'LISTING_NOT_EDITABLE', 'İlan yayınlanamadı.')
        }
        return
      }

      if (!await repository.restoreListingStatus(ownerUserId, listingId, originalStatus)) {
        throw new AppError(500, 'INTERNAL_ERROR', 'İlan durumu geri alınamadı.')
      }
    })

    if (outcome.status === 'failed') {
      throw new AppError(409, 'VERIFICATION_FAILED', 'EİDS yetki doğrulaması başarısız oldu.')
    }
    if (outcome.status === 'unavailable') {
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'EİDS doğrulama servisi şu anda kullanılamıyor.',
      )
    }
    if (!verifiedAt) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Doğrulama zamanı kaydedilemedi.')
    }

    return {
      listing: {
        id: listingId,
        status: 'published',
        publishedAt: verifiedAt.toISOString(),
      },
    }
  }

  async unpublishCarSaleListing(
    ownerUserId: string,
    listingId: string,
  ): Promise<UnpublishCarSaleDraftResponse> {
    const existing = await this.repository.findOwnedCarListing(ownerUserId, listingId)
    if (!existing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    if (existing.status !== 'published') {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayından kaldırılamaz.')
    }
    if (!await this.repository.unpublishOwnedListing(ownerUserId, listingId)) {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayından kaldırılamaz.')
    }
    return {
      listing: {
        id: listingId,
        status: 'inactive',
      },
    }
  }

  private async assertPublishable(
    row: OwnedCarListingRow,
  ): Promise<{ modelYear: number; plateNationality: string }> {
    const listingAttributes = attributes(row)
    if (
      listingAttributes === null
      || row.title === null
      || row.description === null
      || row.priceAmount === null
      || row.currency !== 'TRY'
      || row.provinceId === null
      || row.districtId === null
      || row.neighborhoodId === null
      || row.modelYear === null
      || row.mileageKm === null
      || row.contactPhoneE164 === null
      || row.plateNationality === null
    ) {
      throw new AppError(
        409,
        'LISTING_INCOMPLETE',
        'İlanı yayınlamak için tüm zorunlu alanları doldur.',
      )
    }

    const imageCount = await this.repository.countImages(row.id)
    if (imageCount === 0) {
      throw new AppError(
        409,
        'LISTING_INCOMPLETE',
        'İlanı yayınlamak için en az bir fotoğraf ekle.',
      )
    }

    if (!await this.vehicleCatalog.findActiveModelSummary(row.vehicleModelId)) {
      throw new AppError(
        400,
        'VEHICLE_MODEL_NOT_AVAILABLE',
        'Seçtiğin araç modeli artık kullanılamıyor.',
      )
    }

    if (!await this.locations.resolveActivePath({
      provinceId: row.provinceId,
      districtId: row.districtId,
      neighborhoodId: row.neighborhoodId,
    })) {
      throw new AppError(
        400,
        'LISTING_LOCATION_INVALID',
        'Seçtiğin konum artık kullanılamıyor.',
      )
    }

    return {
      modelYear: row.modelYear,
      plateNationality: row.plateNationality,
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
    const nextFuelType = input.fuelType ?? existing.fuelType
    const nextEngineDisplacementCc = nextFuelType === 'elektrik'
      ? null
      : input.engineDisplacementCc === undefined
        ? existing.engineDisplacementCc
        : input.engineDisplacementCc
    if (nextFuelType && nextFuelType !== 'elektrik' && nextEngineDisplacementCc === null) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Motor hacmi bu yakıt tipi için gerekli.')
    }

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
        fuelType: nextFuelType,
        transmission: input.transmission ?? existing.transmission,
        bodyType: input.bodyType ?? existing.bodyType,
        vehicleCondition: input.vehicleCondition ?? existing.vehicleCondition,
        enginePowerHp: input.enginePowerHp ?? existing.enginePowerHp,
        engineDisplacementCc: nextEngineDisplacementCc,
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

  async removeDraftImage(
    ownerUserId: string,
    listingId: string,
    imageId: string,
  ): Promise<CarSaleDraft> {
    const removed = await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const locked = await repository.lockOwnedListingForImage(ownerUserId, listingId)
      if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      if (locked.status !== 'draft') {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilanın fotoğrafları artık düzenlenemez.')
      }

      const image = await repository.deleteImage(listingId, imageId)
      if (!image) throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
      await repository.compactImageOrder(listingId, image.sortOrder)
      return image
    })

    await Promise.all([
      unlink(path.join(mediaRoot(), removed.storageKey)).catch(() => undefined),
      unlink(path.join(mediaRoot(), removed.cardStorageKey)).catch(() => undefined),
    ])

    return this.getOwnedDraft(ownerUserId, listingId)
  }

  async makeDraftImageCover(
    ownerUserId: string,
    listingId: string,
    imageId: string,
  ): Promise<CarSaleDraft> {
    await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const locked = await repository.lockOwnedListingForImage(ownerUserId, listingId)
      if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      if (locked.status !== 'draft') {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilanın fotoğrafları artık düzenlenemez.')
      }

      if (!await repository.makeImageCover(listingId, imageId)) {
        throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
      }
    })

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

  async readPublicImage(imageId: string, variant: 'card' | 'full' = 'card') {
    const image = await this.repository.findPublicImage(imageId)
    if (!image) throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    const storageKey = variant === 'full' ? image.storageKey : image.cardStorageKey
    try {
      return { mimeType: image.mimeType, bytes: await readFile(path.join(mediaRoot(), storageKey)) }
    } catch {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
    }
  }

  async getPublicCarListing(listingId: string): Promise<PublicCarListingDetailResponse> {
    const row = await this.repository.findPublicCarListingById(listingId)
    if (!row) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')

    const listingAttributes = attributes(row)
    if (
      listingAttributes === null
      || row.title === null
      || row.description === null
      || row.priceAmount === null
      || row.currency !== 'TRY'
      || row.modelYear === null
      || row.mileageKm === null
      || row.provinceName === null
      || row.districtName === null
      || row.neighborhoodName === null
      || (row.selectionPath !== null && row.selectionPath.length === 0)
    ) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }

    const images = await this.repository.listPublicListingImages(listingId)
    return {
      listing: {
        id: row.id,
        title: row.title,
        description: row.description,
        priceAmount: Number(row.priceAmount),
        currency: 'TRY',
        modelYear: row.modelYear,
        mileageKm: row.mileageKm,
        vehicle: {
          brandName: row.brandName,
          seriesName: row.seriesName,
          modelName: row.modelName,
          selectionPath: row.selectionPath ?? [{ key: row.modelCatalogKey, name: row.modelName }],
        },
        location: {
          provinceName: row.provinceName,
          districtName: row.districtName,
          neighborhoodName: row.neighborhoodName,
        },
        attributes: listingAttributes,
        images: images.map((image) => ({
          id: image.id,
          sortOrder: image.sortOrder,
          cardUrl: `/api/v1/listings/public/images/${image.id}`,
          fullUrl: `/api/v1/listings/public/images/${image.id}/full`,
        })),
        contact: {
          showPhone: row.showPhone,
        },
      },
    }
  }

  async getPublicCarListingContact(listingId: string): Promise<PublicCarListingContactResponse> {
    const contact = await this.repository.findPublicListingContact(listingId)
    if (!contact) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (!contact.showPhone || !contact.phoneE164) {
      throw new AppError(404, 'LISTING_CONTACT_NOT_AVAILABLE', 'İlan sahibi telefon numarasını paylaşmadı.')
    }
    return { phoneE164: contact.phoneE164 }
  }

  async listPublicCarListings(
    query: PublicCarListingQuery,
  ): Promise<PublicCarListingListResponse> {
    const { limit, cursor, sort, filters } = query
    assertRange(filters.minPrice, filters.maxPrice, 'Fiyat')
    assertRange(filters.minYear, filters.maxYear, 'Yıl')
    assertRange(filters.minMileageKm, filters.maxMileageKm, 'Kilometre')

    const decodedCursor = cursor ? decodePublicCursor(cursor) : undefined
    if (
      decodedCursor
      && (decodedCursor.sort !== sort || decodedCursor.filterKey !== publicFiltersKey(filters))
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Liste devam bilgisi geçersiz.')
    }

    const rows = await this.repository.listPublicCarListings(limit + 1, {
      sort,
      filters,
      ...(decodedCursor ? { cursor: decodedCursor } : {}),
    })
    const pageRows = rows.slice(0, limit)
    const lastRow = pageRows[pageRows.length - 1]

    return {
      items: pageRows.flatMap((row) => {
        const listingAttributes = attributes(row)
        if (
          listingAttributes === null
          || row.title === null
          || row.priceAmount === null
          || row.currency !== 'TRY'
          || row.modelYear === null
          || row.mileageKm === null
          || row.provinceName === null
          || row.districtName === null
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
          attributes: listingAttributes,
          imageUrl: row.imageId ? `/api/v1/listings/public/images/${row.imageId}` : null,
        }]
      }),
      nextCursor: rows.length > limit && lastRow
        ? encodePublicCursor({
          sort,
          filterKey: publicFiltersKey(filters),
          value: cursorValue(lastRow, sort),
          id: lastRow.id,
        })
        : null,
    }
  }
}
