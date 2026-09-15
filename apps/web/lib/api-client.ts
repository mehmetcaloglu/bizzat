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

  if (!response.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = await response.json() as ApiErrorBody
    } catch {
      body = null
    }

    throw new ApiClientError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'İstek tamamlanamadı.',
    )
  }

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
