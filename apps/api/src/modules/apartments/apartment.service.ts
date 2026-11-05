import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  ApartmentDraftResponse,
  ApartmentOwnerListingListResponse,
  ApartmentTransactionType,
  PublicApartmentListingContactResponse,
  PublicApartmentListingDetailResponse,
  PublicApartmentListingListResponse,
  PublicApartmentListingSort,
  UpdateApartmentDraftDetailsRequest,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import type { LocationService } from '../../reference/location.service.js'
import {
  ListingImageValidationError,
  processListingImage,
} from '../listings/listing-media.js'
import {
  ListingRepository,
  type ApartmentFeedFilters,
  type ApartmentListingRow,
  type ApartmentOwnerSummaryRow,
  type PublicApartmentCursor,
  type PublicApartmentListingRow,
} from '../listings/listing.repository.js'
import type {
  VerificationOutcome,
  VerificationProvider,
} from '../verifications/verification.provider.js'

type ApartmentDraft = ApartmentDraftResponse['listing']
type ApartmentAttributeValues = PublicApartmentListingListResponse['items'][number]['attributes']

const editableListingStatuses = ['draft', 'published', 'inactive'] as const

function isEditableListingStatus(status: string): boolean {
  return (editableListingStatuses as readonly string[]).includes(status)
}

function mediaRoot(): string {
  return path.resolve(process.env.BIZZAT_MEDIA_ROOT ?? '.data/media')
}

function transactionType(row: ApartmentListingRow): ApartmentTransactionType {
  if (row.transactionType === 'rent' || row.listingTypeCode === 'apartment_rent') return 'rent'
  return 'sale'
}

function listingTypeCode(value: ApartmentTransactionType): 'apartment_sale' | 'apartment_rent' {
  return value === 'rent' ? 'apartment_rent' : 'apartment_sale'
}

function draftType(value: ApartmentTransactionType): 'apartment_sale' | 'apartment_rent' {
  return listingTypeCode(value)
}

function attributes(row: ApartmentListingRow): ApartmentAttributeValues | null {
  if (
    row.roomCount === null
    || row.grossM2 === null
    || row.heating === null
    || row.bathroomCount === null
    || row.kitchen === null
    || row.balcony === null
    || row.elevator === null
    || row.parking === null
    || row.furnished === null
    || row.occupancy === null
    || row.inSite === null
    || row.deedStatus === null
  ) {
    return null
  }

  return {
    roomCount: row.roomCount as ApartmentAttributeValues['roomCount'],
    grossM2: row.grossM2,
    netM2: row.netM2,
    buildingAge: row.buildingAge,
    floor: row.floor,
    floorLabel: row.floorLabel as ApartmentAttributeValues['floorLabel'],
    totalFloors: row.totalFloors,
    heating: row.heating as ApartmentAttributeValues['heating'],
    bathroomCount: row.bathroomCount,
    kitchen: row.kitchen as ApartmentAttributeValues['kitchen'],
    balcony: row.balcony,
    elevator: row.elevator,
    parking: row.parking as ApartmentAttributeValues['parking'],
    furnished: row.furnished,
    occupancy: row.occupancy as ApartmentAttributeValues['occupancy'],
    inSite: row.inSite,
    deedStatus: row.deedStatus as ApartmentAttributeValues['deedStatus'],
    creditEligible: row.creditEligible,
    swapAvailable: row.swapAvailable,
    depositAmount: row.depositAmount === null ? null : Number(row.depositAmount),
  }
}

function draft(row: ApartmentListingRow, images: ApartmentDraft['images']): ApartmentDraft {
  const transaction = transactionType(row)
  const details = (
    row.priceAmount === null
    || row.description === null
    || row.provinceId === null
    || row.provinceName === null
    || row.districtId === null
    || row.districtName === null
    || row.neighborhoodId === null
    || row.neighborhoodName === null
    || attributes(row) === null
  ) ? null : {
    priceAmount: Number(row.priceAmount),
    currency: 'TRY' as const,
    description: row.description,
    location: {
      province: { id: row.provinceId, name: row.provinceName },
      district: { id: row.districtId, name: row.districtName },
      neighborhood: { id: row.neighborhoodId, name: row.neighborhoodName },
    },
    ...attributes(row)!,
  }

  return {
    id: row.id,
    status: row.status as ApartmentDraft['status'],
    type: draftType(transaction),
    transactionType: transaction,
    title: row.title,
    details,
    contact: row.contactPhoneE164
      ? { phoneE164: row.contactPhoneE164, showPhone: row.showPhone }
      : null,
    images,
  }
}

function imageSummary(listingId: string, image: {
  id: string
  sortOrder: number
}): ApartmentDraft['images'][number] {
  return {
    id: image.id,
    url: `/api/v1/listings/${listingId}/images/${image.id}`,
    sortOrder: image.sortOrder,
  }
}

function activeLocationOrThrow(
  path: Awaited<ReturnType<LocationService['resolveActivePath']>>,
): NonNullable<typeof path> {
  if (!path) {
    throw new AppError(
      400,
      'LISTING_LOCATION_INVALID',
      'Seçtiğin konum artık kullanılamıyor.',
    )
  }
  return path
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

const publicApartmentSorts: PublicApartmentListingSort[] = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'gross_m2_asc',
  'gross_m2_desc',
]

function filterKey(filters: ApartmentFeedFilters): string {
  return JSON.stringify(Object.entries(filters).sort(([left], [right]) => left.localeCompare(right)))
}

function encodeCursor(cursor: PublicApartmentCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(cursor: string): PublicApartmentCursor {
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
    const { sort, filterKey: cursorFilterKey, value, id } = parsed as Record<string, unknown>
    if (
      typeof sort !== 'string'
      || !publicApartmentSorts.includes(sort as PublicApartmentListingSort)
      || typeof cursorFilterKey !== 'string'
      || typeof value !== 'string'
      || value.length === 0
      || typeof id !== 'string'
      || id.length === 0
    ) {
      throw new Error('invalid cursor')
    }
    return {
      sort: sort as PublicApartmentListingSort,
      filterKey: cursorFilterKey,
      value,
      id,
    }
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Liste devam bilgisi geçersiz.')
  }
}

function cursorValue(row: PublicApartmentListingRow, sort: PublicApartmentListingSort): string {
  switch (sort) {
    case 'newest':
    case 'oldest':
      return row.publishedAtCursor
    case 'price_asc':
    case 'price_desc':
      return row.priceCursor
    case 'gross_m2_asc':
    case 'gross_m2_desc':
      return row.grossM2Cursor
  }
}

export interface PublicApartmentQuery {
  limit: number
  cursor?: string
  sort: PublicApartmentListingSort
  filters: ApartmentFeedFilters
}

export class ApartmentService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: ListingRepository,
    private readonly locations: LocationService,
    private readonly verificationProvider: VerificationProvider,
  ) {}

  async createDraft(
    ownerUserId: string,
    type: ApartmentTransactionType,
  ): Promise<ApartmentDraft> {
    const listingType = await this.repository.findListingTypeByCode(listingTypeCode(type))
    if (!listingType) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Daire ilan türü bulunamadı.')
    }
    const created = await this.repository.insertDraft({
      ownerUserId,
      listingTypeId: listingType.id,
    })
    return await this.getOwnedEditableListing(ownerUserId, created.id)
  }

  async getOwnedEditableListing(ownerUserId: string, listingId: string): Promise<ApartmentDraft> {
    const row = await this.repository.findOwnedApartmentListing(ownerUserId, listingId)
    if (!row) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (!isEditableListingStatus(row.status)) {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık düzenlenemez.')
    }
    const images = await this.repository.listImages(listingId)
    return draft(row, images.map((image) => imageSummary(listingId, image)))
  }

  async updateDetails(
    ownerUserId: string,
    listingId: string,
    input: UpdateApartmentDraftDetailsRequest,
  ): Promise<ApartmentDraft> {
    const existing = await this.repository.findOwnedApartmentListing(ownerUserId, listingId)
    if (!existing) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (!isEditableListingStatus(existing.status)) {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık düzenlenemez.')
    }

    const transaction = transactionType(existing)
    activeLocationOrThrow(await this.locations.resolveActivePath({
      provinceId: input.provinceId,
      districtId: input.districtId,
      neighborhoodId: input.neighborhoodId,
    }))

    await this.db.transaction().execute(async (inner) => {
      const repository = new ListingRepository(inner)
      const updated = await repository.updateOwnedApartmentCore({
        ownerUserId,
        listingId,
        title: input.title ?? existing.title,
        description: input.description,
        priceAmount: input.priceAmount,
        provinceId: input.provinceId,
        districtId: input.districtId,
        neighborhoodId: input.neighborhoodId,
        contactPhoneE164: input.contactPhoneE164 ?? existing.contactPhoneE164,
        showPhone: input.showPhone ?? existing.showPhone,
      })
      if (!updated) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık düzenlenemez.')
      }
      await repository.upsertApartmentDetails({
        listingId,
        transactionType: transaction,
        roomCount: input.roomCount,
        grossM2: input.grossM2,
        netM2: input.netM2,
        buildingAge: input.buildingAge,
        floor: input.floorLabel === null ? input.floor : null,
        floorLabel: input.floorLabel,
        totalFloors: input.totalFloors,
        heating: input.heating,
        bathroomCount: input.bathroomCount,
        kitchen: input.kitchen,
        balcony: input.balcony,
        elevator: input.elevator,
        parking: input.parking,
        furnished: input.furnished,
        occupancy: input.occupancy,
        inSite: input.inSite,
        deedStatus: input.deedStatus,
        creditEligible: transaction === 'sale' ? input.creditEligible : null,
        swapAvailable: transaction === 'sale' ? input.swapAvailable : null,
        depositAmount: transaction === 'rent' ? input.depositAmount : null,
      })
    })

    return await this.getOwnedEditableListing(ownerUserId, listingId)
  }

  async uploadDraftImage(
    ownerUserId: string,
    listingId: string,
    mimeType: string,
    bytes: Buffer,
  ): Promise<ApartmentDraft> {
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
        if (!isEditableListingStatus(locked.status)) {
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

    return await this.getOwnedEditableListing(ownerUserId, listingId)
  }

  async removeDraftImage(
    ownerUserId: string,
    listingId: string,
    imageId: string,
  ): Promise<ApartmentDraft> {
    const removed = await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const locked = await repository.lockOwnedListingForImage(ownerUserId, listingId)
      if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      if (!isEditableListingStatus(locked.status)) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilanın fotoğrafları artık düzenlenemez.')
      }
      if (locked.status === 'published' && await repository.countImages(listingId) <= 1) {
        throw new AppError(
          409,
          'LISTING_NOT_EDITABLE',
          'Yayındaki ilanın son fotoğrafını kaldıramazsın.',
        )
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
    return await this.getOwnedEditableListing(ownerUserId, listingId)
  }

  async makeDraftImageCover(
    ownerUserId: string,
    listingId: string,
    imageId: string,
  ): Promise<ApartmentDraft> {
    await this.db.transaction().execute(async (transaction) => {
      const repository = new ListingRepository(transaction)
      const locked = await repository.lockOwnedListingForImage(ownerUserId, listingId)
      if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      if (!isEditableListingStatus(locked.status)) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilanın fotoğrafları artık düzenlenemez.')
      }
      if (!await repository.makeImageCover(listingId, imageId)) {
        throw new AppError(404, 'LISTING_NOT_FOUND', 'Fotoğraf bulunamadı.')
      }
    })
    return await this.getOwnedEditableListing(ownerUserId, listingId)
  }

  async publishOwnedListing(
    ownerUserId: string,
    listingId: string,
  ): Promise<{ listing: { id: string; status: 'published'; publishedAt: string } }> {
    const existing = await this.repository.findOwnedApartmentListing(ownerUserId, listingId)
    if (!existing) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (existing.status !== 'draft' && existing.status !== 'inactive') {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
    }
    const transaction = transactionType(existing)
    await this.assertPublishable(existing)

    const originalStatus = existing.status
    const pendingCheck = await this.db.transaction().execute(async (inner) => {
      const repository = new ListingRepository(inner)
      const locked = await repository.lockOwnedListingForStatus(ownerUserId, listingId)
      if (!locked) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
      if (locked.status !== 'draft' && locked.status !== 'inactive') {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
      }
      if (!await repository.markListingPendingVerification(ownerUserId, listingId)) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayınlanamaz.')
      }
      return await repository.insertPendingVerificationCheck({
        listingId,
        type: 'property_authority',
        provider: this.verificationProvider.name,
      })
    })

    let outcome: VerificationOutcome
    try {
      outcome = await this.verificationProvider.verifyPropertyAuthority({
        listingId,
        ownerUserId,
        listingType: listingTypeCode(transaction),
      })
    } catch {
      outcome = { status: 'unavailable', failureCode: 'VERIFICATION_PROVIDER_ERROR' }
    }

    const verifiedAt = outcome.status === 'verified' ? new Date() : null
    await this.db.transaction().execute(async (inner) => {
      const repository = new ListingRepository(inner)
      const completed = await repository.completeVerificationCheck({
        checkId: pendingCheck.id,
        status: outcome.status,
        providerReference: outcome.status === 'verified' ? outcome.providerReference : null,
        failureCode: outcome.status === 'verified' ? null : outcome.failureCode,
        verifiedAt,
      })
      if (!completed) throw new AppError(500, 'INTERNAL_ERROR', 'Doğrulama sonucu kaydedilemedi.')
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
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'EİDS doğrulama servisi şu anda kullanılamıyor.')
    }
    if (!verifiedAt) throw new AppError(500, 'INTERNAL_ERROR', 'Doğrulama zamanı kaydedilemedi.')

    return {
      listing: {
        id: listingId,
        status: 'published',
        publishedAt: verifiedAt.toISOString(),
      },
    }
  }

  async unpublishOwnedListing(
    ownerUserId: string,
    listingId: string,
  ): Promise<{ listing: { id: string; status: 'inactive' } }> {
    const existing = await this.repository.findOwnedApartmentListing(ownerUserId, listingId)
    if (!existing) throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    if (existing.status !== 'published') {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayından kaldırılamaz.')
    }
    if (!await this.repository.unpublishOwnedListing(ownerUserId, listingId)) {
      throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan şu anda yayından kaldırılamaz.')
    }
    return { listing: { id: listingId, status: 'inactive' } }
  }

  async listOwned(ownerUserId: string): Promise<ApartmentOwnerListingListResponse> {
    const rows = await this.repository.listOwnedApartmentSummaries(ownerUserId)
    return { items: rows.map((row) => this.ownerSummary(row)) }
  }

  async listPublic(query: PublicApartmentQuery): Promise<PublicApartmentListingListResponse> {
    const { limit, cursor, sort, filters } = query
    assertRange(filters.minPrice, filters.maxPrice, 'Fiyat')
    assertRange(filters.minGrossM2, filters.maxGrossM2, 'Brüt metrekare')
    assertRange(filters.minBuildingAge, filters.maxBuildingAge, 'Bina yaşı')
    assertRange(filters.minFloor, filters.maxFloor, 'Kat')

    const decoded = cursor ? decodeCursor(cursor) : undefined
    if (decoded && (decoded.sort !== sort || decoded.filterKey !== filterKey(filters))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Liste devam bilgisi geçersiz.')
    }

    const rows = await this.repository.listPublicApartmentListings(limit + 1, {
      sort,
      filters,
      ...(decoded ? { cursor: decoded } : {}),
    })
    const pageRows = rows.slice(0, limit)
    const lastRow = pageRows[pageRows.length - 1]
    return {
      items: pageRows.flatMap((row) => {
        const item = this.publicItem(row)
        return item ? [item] : []
      }),
      nextCursor: rows.length > limit && lastRow
        ? encodeCursor({
          sort,
          filterKey: filterKey(filters),
          value: cursorValue(lastRow, sort),
          id: lastRow.id,
        })
        : null,
    }
  }

  async getPublic(id: string): Promise<PublicApartmentListingDetailResponse> {
    const row = await this.repository.findPublicApartmentById(id)
    const item = row ? this.publicItem(row) : null
    if (!row || !item || row.description === null || row.neighborhoodName === null) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'İlan bulunamadı.')
    }
    const images = await this.repository.listPublicListingImages(id)
    return {
      listing: {
        ...item,
        description: row.description,
        totalFloors: row.totalFloors,
        location: {
          ...item.location,
          neighborhoodName: row.neighborhoodName,
        },
        images: images.map((image) => ({
          id: image.id,
          sortOrder: image.sortOrder,
          cardUrl: `/api/v1/listings/public/images/${image.id}`,
          fullUrl: `/api/v1/listings/public/images/${image.id}/full`,
        })),
        contact: { showPhone: row.showPhone },
      },
    }
  }

  async getPublicContact(id: string): Promise<PublicApartmentListingContactResponse> {
    const row = await this.repository.findPublicApartmentContact(id)
    if (!row || !row.showPhone || !row.phoneE164) {
      throw new AppError(
        404,
        'LISTING_CONTACT_NOT_AVAILABLE',
        'İlan sahibi telefon numarasını paylaşmadı.',
      )
    }
    return { phoneE164: row.phoneE164 }
  }

  private publicItem(row: ApartmentListingRow): PublicApartmentListingListResponse['items'][number] | null {
    const listingAttributes = attributes(row)
    if (
      !listingAttributes
      || row.title === null
      || row.priceAmount === null
      || row.provinceName === null
      || row.districtName === null
      || row.grossM2 === null
      || row.roomCount === null
    ) return null
    return {
      id: row.id,
      type: draftType(transactionType(row)),
      title: row.title,
      priceAmount: Number(row.priceAmount),
      currency: 'TRY',
      roomCount: row.roomCount as PublicApartmentListingListResponse['items'][number]['roomCount'],
      grossM2: row.grossM2,
      netM2: row.netM2,
      buildingAge: row.buildingAge,
      floor: row.floor,
      location: {
        provinceName: row.provinceName,
        districtName: row.districtName,
      },
      attributes: listingAttributes,
      imageUrl: row.imageId ? `/api/v1/listings/public/images/${row.imageId}` : null,
    }
  }

  private ownerSummary(row: ApartmentOwnerSummaryRow): ApartmentOwnerListingListResponse['items'][number] {
    return {
      id: row.id,
      type: row.listingTypeCode === 'apartment_rent' ? 'apartment_rent' : 'apartment_sale',
      status: row.status as ApartmentOwnerListingListResponse['items'][number]['status'],
      title: row.title,
      priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
      currency: row.currency === 'TRY' ? 'TRY' : null,
      roomCount: row.roomCount as ApartmentOwnerListingListResponse['items'][number]['roomCount'],
      grossM2: row.grossM2,
      location: {
        provinceName: row.provinceName,
        districtName: row.districtName,
      },
      imageUrl: row.imageId ? `/api/v1/listings/${row.id}/images/${row.imageId}` : null,
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    }
  }

  private async assertPublishable(row: ApartmentListingRow): Promise<void> {
    const listingAttributes = attributes(row)
    if (
      !listingAttributes
      || row.title === null
      || row.description === null
      || row.priceAmount === null
      || row.provinceId === null
      || row.districtId === null
      || row.neighborhoodId === null
      || row.contactPhoneE164 === null
    ) {
      throw new AppError(409, 'LISTING_INCOMPLETE', 'İlanı yayınlamak için tüm zorunlu alanları doldur.')
    }
    if (await this.repository.countImages(row.id) === 0) {
      throw new AppError(409, 'LISTING_INCOMPLETE', 'İlanı yayınlamak için en az bir fotoğraf ekle.')
    }
    if (!await this.locations.resolveActivePath({
      provinceId: row.provinceId,
      districtId: row.districtId,
      neighborhoodId: row.neighborhoodId,
    })) {
      throw new AppError(400, 'LISTING_LOCATION_INVALID', 'Seçtiğin konum artık kullanılamıyor.')
    }
    if (transactionType(row) === 'sale') {
      if (listingAttributes.creditEligible === null || listingAttributes.swapAvailable === null) {
        throw new AppError(409, 'LISTING_INCOMPLETE', 'Kredi ve takas bilgilerini tamamla.')
      }
    } else if (listingAttributes.depositAmount === null) {
      throw new AppError(409, 'LISTING_INCOMPLETE', 'Kiralık ilan için depozito bilgisini doldur.')
    }
  }
}
