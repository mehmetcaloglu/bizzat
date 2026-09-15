import type { CarSaleDraftResponse } from '@bizzat/contracts'
import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import type { VehicleCatalogService } from '../../reference/vehicle/vehicle-catalog.service.js'
import { ListingRepository } from './listing.repository.js'

type CarSaleDraft = CarSaleDraftResponse['listing']

export class ListingService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly repository: ListingRepository,
    private readonly vehicleCatalog: VehicleCatalogService,
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
    }
  }

  async getOwnedDraft(ownerUserId: string, listingId: string): Promise<CarSaleDraft> {
    const draft = await this.repository.findOwnedCarDraft(ownerUserId, listingId)
    if (!draft) {
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
    }
  }
}
