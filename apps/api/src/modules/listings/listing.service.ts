import type {
  CarSaleDraftResponse,
  UpdateCarSaleDraftCoreDetailsRequest,
} from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import type { LocationService } from '../../reference/location.service.js'
import type { VehicleCatalogService } from '../../reference/vehicle/vehicle-catalog.service.js'
import { ListingRepository, type OwnedCarListingRow } from './listing.repository.js'

type CarSaleDraft = CarSaleDraftResponse['listing']

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
      throw new AppError(
        400,
        'VEHICLE_MODEL_NOT_AVAILABLE',
        'Seçtiğin araç modeli kullanılamıyor.',
      )
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

    return {
      id: draft.id,
      status: 'draft',
      type: 'car_sale',
      vehicle,
      details: coreDetails(draft),
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
        description,
        priceAmount: input.priceAmount,
        provinceId: input.provinceId,
        districtId: input.districtId,
        neighborhoodId: input.neighborhoodId,
      })
      if (!listingUpdated) {
        throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Bu ilan artık taslak olarak düzenlenemez.')
      }

      const detailsUpdated = await repository.updateCarDetails({
        listingId,
        modelYear: input.modelYear,
        mileageKm: input.mileageKm,
      })
      if (!detailsUpdated) {
        throw new AppError(500, 'INTERNAL_ERROR', 'İlan detayları güncellenemedi.')
      }
    })

    return this.getOwnedDraft(ownerUserId, listingId)
  }
}
