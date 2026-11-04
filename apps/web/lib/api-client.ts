import type {
  VehicleReferenceItem,
  VehicleSelectionItem,
} from '../app/ilan-ver/otomobil/vehicle-picker-state'

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

export interface MeSummary {
  user: {
    id: string
    name: string
    email: string
  }
  profile: {
    role: string
  }
}

export interface LocationReferenceItem {
  id: string
  name: string
}

export interface ProvinceReferenceItem extends LocationReferenceItem {
  code: string
}

export interface NeighborhoodReferenceItem extends LocationReferenceItem {
  kind: string | null
}

export type CarFuelType = 'benzin' | 'dizel' | 'lpg' | 'hibrit' | 'elektrik'
export type CarTransmission = 'manuel' | 'otomatik' | 'yari_otomatik'
export type CarBodyType =
  | 'hatchback'
  | 'sedan'
  | 'station_wagon'
  | 'suv'
  | 'coupe'
  | 'cabrio'
  | 'mpv'
  | 'roadster'
  | 'diger'

export type CarVehicleCondition = 'second_hand' | 'imported_new' | 'new'
export type CarDrivetrain = 'front' | 'rear' | 'four_wd' | 'awd'
export type CarPlateNationality = 'tr' | 'ma'
export type CarPaintStatus = 'original' | 'partial' | 'painted'
export type CarReplacementStatus = 'none' | 'replaced'

export interface CarSaleDraftCoreDetails {
  modelYear: number
  mileageKm: number
  priceAmount: number
  currency: 'TRY'
  description: string
  location: {
    province: LocationReferenceItem
    district: LocationReferenceItem
    neighborhood: LocationReferenceItem
  }
}

export interface ListingImageSummary {
  id: string
  url: string
  sortOrder: number
}

export interface CarSaleDraftResponse {
  listing: {
    id: string
    status: 'draft'
    type: 'car_sale'
    vehicle: {
      modelId: string
      brand: VehicleReferenceItem
      series: VehicleReferenceItem
      selectionPath: Array<{ key: string; name: string }>
    }
    details: CarSaleDraftCoreDetails | null
    title: string | null
    attributes: {
      fuelType: CarFuelType
      transmission: CarTransmission
      vehicleCondition: CarVehicleCondition
      bodyType: CarBodyType
      enginePowerHp: number
      engineDisplacementCc: number | null
      drivetrain: CarDrivetrain
      color: string
      underWarranty: boolean
      heavyDamageRecorded: boolean
      plateNationality: CarPlateNationality
      swapAvailable: boolean
      paintStatus: CarPaintStatus
      replacementStatus: CarReplacementStatus
    } | null
    contact: {
      phoneE164: string
      showPhone: boolean
    } | null
    images: ListingImageSummary[]
  }
}

export interface UpdateCarSaleDraftCoreDetailsInput {
  modelYear: number
  mileageKm: number
  priceAmount: number
  provinceId: string
  districtId: string
  neighborhoodId: string
  description: string
  title: string
  fuelType: CarFuelType
  transmission: CarTransmission
  bodyType: CarBodyType
  vehicleCondition: CarVehicleCondition
  enginePowerHp: number
  engineDisplacementCc: number | null
  drivetrain: CarDrivetrain
  color: string
  underWarranty: boolean
  heavyDamageRecorded: boolean
  plateNationality: CarPlateNationality
  swapAvailable: boolean
  paintStatus: CarPaintStatus
  replacementStatus: CarReplacementStatus
  contactPhoneE164: string
  showPhone: boolean
}

export interface PublicCarListingAttributes {
  fuelType: CarFuelType
  transmission: CarTransmission
  vehicleCondition: CarVehicleCondition
  bodyType: CarBodyType
  enginePowerHp: number
  engineDisplacementCc: number | null
  drivetrain: CarDrivetrain
  color: string
  underWarranty: boolean
  heavyDamageRecorded: boolean
  plateNationality: CarPlateNationality
  swapAvailable: boolean
  paintStatus: CarPaintStatus
  replacementStatus: CarReplacementStatus
}

export interface PublicCarListingItem {
  id: string
  title: string
  priceAmount: number
  currency: 'TRY'
  modelYear: number
  mileageKm: number
  vehicle: {
    brandName: string
    seriesName: string
  }
  location: {
    provinceName: string
    districtName: string
  }
  attributes: PublicCarListingAttributes
  imageUrl: string | null
}

export interface PublicCarListingDetailImage {
  id: string
  sortOrder: number
  cardUrl: string
  fullUrl: string
}

export interface PublicCarListingDetail {
  id: string
  title: string
  description: string
  priceAmount: number
  currency: 'TRY'
  modelYear: number
  mileageKm: number
  vehicle: {
    brandName: string
    seriesName: string
    modelName: string
    selectionPath: Array<{ key: string; name: string }>
  }
  location: {
    provinceName: string
    districtName: string
    neighborhoodName: string
  }
  attributes: PublicCarListingAttributes
  images: PublicCarListingDetailImage[]
  contact: {
    showPhone: boolean
  }
}

export type OwnerCarListingStatus =
  | 'draft'
  | 'pending_verification'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'inactive'

export interface OwnerCarListingSummary {
  id: string
  type: 'car_sale'
  status: OwnerCarListingStatus
  title: string | null
  priceAmount: number | null
  currency: 'TRY' | null
  modelYear: number | null
  mileageKm: number | null
  vehicle: {
    brandName: string
    seriesName: string
    modelName: string
  }
  location: {
    provinceName: string | null
    districtName: string | null
  }
  imageUrl: string | null
  updatedAt: string
  publishedAt: string | null
}

export interface OwnerCarListingListResponse {
  items: OwnerCarListingSummary[]
}

export interface PublishCarSaleListingResponse {
  listing: {
    id: string
    status: 'published'
    publishedAt: string
  }
}

export interface UnpublishCarSaleListingResponse {
  listing: {
    id: string
    status: 'inactive'
  }
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

async function apiError(response: Response): Promise<ApiClientError> {
  let body: ApiErrorBody | null = null
  try {
    body = await response.json() as ApiErrorBody
  } catch {
    body = null
  }

  return new ApiClientError(
    response.status,
    body?.error?.code ?? 'REQUEST_FAILED',
    body?.error?.message ?? 'İstek tamamlanamadı.',
  )
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) throw await apiError(response)
  return await response.json() as T
}

export function getMe(): Promise<MeSummary> {
  return requestJson<MeSummary>('/api/v1/me')
}

export async function listVehicleBrands(): Promise<VehicleReferenceItem[]> {
  const response = await requestJson<{ items: VehicleReferenceItem[] }>(
    '/api/v1/reference/vehicle/brands',
  )
  return response.items
}

export async function listVehicleSeries(brandId: string): Promise<VehicleReferenceItem[]> {
  const response = await requestJson<{ items: VehicleReferenceItem[] }>(
    `/api/v1/reference/vehicle/brands/${encodeURIComponent(brandId)}/series`,
  )
  return response.items
}

export async function listVehicleSelection(
  seriesId: string,
  parentKey?: string,
): Promise<VehicleSelectionItem[]> {
  const query = parentKey === undefined
    ? ''
    : `?parentKey=${encodeURIComponent(parentKey)}`
  const response = await requestJson<{ items: VehicleSelectionItem[] }>(
    `/api/v1/reference/vehicle/series/${encodeURIComponent(seriesId)}/selection${query}`,
  )
  return response.items
}

export async function listProvinces(): Promise<ProvinceReferenceItem[]> {
  const response = await requestJson<{ items: ProvinceReferenceItem[] }>(
    '/api/v1/reference/provinces',
  )
  return response.items
}

export async function listDistricts(provinceId: string): Promise<LocationReferenceItem[]> {
  const response = await requestJson<{ items: LocationReferenceItem[] }>(
    `/api/v1/reference/provinces/${encodeURIComponent(provinceId)}/districts`,
  )
  return response.items
}

export async function listNeighborhoods(districtId: string): Promise<NeighborhoodReferenceItem[]> {
  const response = await requestJson<{ items: NeighborhoodReferenceItem[] }>(
    `/api/v1/reference/districts/${encodeURIComponent(districtId)}/neighborhoods`,
  )
  return response.items
}

export function createCarSaleDraft(vehicleModelId: string): Promise<CarSaleDraftResponse> {
  return requestJson<CarSaleDraftResponse>('/api/v1/listings/car-sale/drafts', {
    method: 'POST',
    body: JSON.stringify({ vehicleModelId }),
  })
}

export function updateCarSaleDraftCoreDetails(
  listingId: string,
  input: UpdateCarSaleDraftCoreDetailsInput,
): Promise<CarSaleDraftResponse> {
  return requestJson<CarSaleDraftResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/car-sale/details`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function getOwnedCarListing(listingId: string): Promise<CarSaleDraftResponse> {
  return requestJson<CarSaleDraftResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`,
  )
}

export async function uploadCarSaleDraftImage(
  listingId: string,
  file: File,
): Promise<CarSaleDraftResponse> {
  const response = await fetch(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': file.type,
      },
      body: file,
    },
  )
  if (!response.ok) throw await apiError(response)
  return await response.json() as CarSaleDraftResponse
}

export interface PublicCarListingPage {
  items: PublicCarListingItem[]
  nextCursor: string | null
}

export function listPublicCarListings(
  limit = 12,
  cursor?: string,
): Promise<PublicCarListingPage> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (cursor) query.set('cursor', cursor)
  return requestJson<PublicCarListingPage>(
    `/api/v1/listings/public/car-sale?${query.toString()}`,
  )
}

export function getPublicCarListing(
  listingId: string,
): Promise<{ listing: PublicCarListingDetail }> {
  return requestJson<{ listing: PublicCarListingDetail }>(
    `/api/v1/listings/public/car-sale/${encodeURIComponent(listingId)}`,
  )
}

export function getPublicCarListingContact(listingId: string): Promise<{ phoneE164: string }> {
  return requestJson<{ phoneE164: string }>(
    `/api/v1/listings/public/car-sale/${encodeURIComponent(listingId)}/contact`,
  )
}

export function listMyCarListings(): Promise<OwnerCarListingListResponse> {
  return requestJson<OwnerCarListingListResponse>('/api/v1/me/listings')
}

export function publishCarSaleListing(
  listingId: string,
): Promise<PublishCarSaleListingResponse> {
  return requestJson<PublishCarSaleListingResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/publish`,
    { method: 'POST' },
  )
}

export function unpublishCarSaleListing(
  listingId: string,
): Promise<UnpublishCarSaleListingResponse> {
  return requestJson<UnpublishCarSaleListingResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/unpublish`,
    { method: 'POST' },
  )
}

export function removeCarSaleDraftImage(
  listingId: string,
  imageId: string,
): Promise<CarSaleDraftResponse> {
  return requestJson<CarSaleDraftResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE' },
  )
}

export function makeCarSaleDraftImageCover(
  listingId: string,
  imageId: string,
): Promise<CarSaleDraftResponse> {
  return requestJson<CarSaleDraftResponse>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(imageId)}/cover`,
    { method: 'PATCH' },
  )
}
