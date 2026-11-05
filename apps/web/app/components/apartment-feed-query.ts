import type {
  ApartmentFeedFilters,
  ApartmentHeating,
  ApartmentParking,
  ApartmentRoomCount,
  ApartmentTransactionType,
  PublicApartmentListingSort,
} from '../../lib/api-client'

export const apartmentRoomCounts: ApartmentRoomCount[] = [
  'studio', '1+0', '1+1', '1.5+1', '2+0', '2+1', '2.5+1', '2+2',
  '3+0', '3+1', '3.5+1', '3+2', '4+0', '4+1', '4.5+1', '4+2',
  '5+1', '5+2', '6+1', '7+1', '8+1', '9+1', '10+',
]

export const apartmentHeatingValues: ApartmentHeating[] = [
  'none', 'stove', 'central', 'combi', 'underfloor',
  'air_conditioning', 'heat_pump', 'solar', 'fireplace',
]

export const apartmentParkingValues: ApartmentParking[] = [
  'none', 'open', 'closed', 'both',
]

export const apartmentSortValues: PublicApartmentListingSort[] = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'gross_m2_asc',
  'gross_m2_desc',
]

export interface ApartmentFeedFormValues {
  q: string
  provinceId: string
  districtId: string
  roomCount: string
  minPrice: string
  maxPrice: string
  minGrossM2: string
  maxGrossM2: string
  maxBuildingAge: string
  heating: string
  parking: string
  furnished: string
  inSite: string
}

export const emptyApartmentFeedForm: ApartmentFeedFormValues = {
  q: '',
  provinceId: '',
  districtId: '',
  roomCount: '',
  minPrice: '',
  maxPrice: '',
  minGrossM2: '',
  maxGrossM2: '',
  maxBuildingAge: '',
  heating: '',
  parking: '',
  furnished: '',
  inSite: '',
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanOrUndefined(value: string): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function filtersFromApartmentForm(
  transactionType: ApartmentTransactionType,
  form: ApartmentFeedFormValues,
): ApartmentFeedFilters {
  const filters: ApartmentFeedFilters = { transactionType }
  if (form.q.trim()) filters.q = form.q.trim()
  if (form.provinceId) filters.provinceId = form.provinceId
  if (form.districtId) filters.districtId = form.districtId
  if (apartmentRoomCounts.includes(form.roomCount as ApartmentRoomCount)) {
    filters.roomCount = form.roomCount as ApartmentRoomCount
  }
  const minPrice = numberOrUndefined(form.minPrice)
  const maxPrice = numberOrUndefined(form.maxPrice)
  const minGrossM2 = numberOrUndefined(form.minGrossM2)
  const maxGrossM2 = numberOrUndefined(form.maxGrossM2)
  const maxBuildingAge = numberOrUndefined(form.maxBuildingAge)
  if (minPrice !== undefined) filters.minPrice = minPrice
  if (maxPrice !== undefined) filters.maxPrice = maxPrice
  if (minGrossM2 !== undefined) filters.minGrossM2 = minGrossM2
  if (maxGrossM2 !== undefined) filters.maxGrossM2 = maxGrossM2
  if (maxBuildingAge !== undefined) filters.maxBuildingAge = maxBuildingAge
  if (apartmentHeatingValues.includes(form.heating as ApartmentHeating)) {
    filters.heating = form.heating as ApartmentHeating
  }
  if (apartmentParkingValues.includes(form.parking as ApartmentParking)) {
    filters.parking = form.parking as ApartmentParking
  }
  const furnished = booleanOrUndefined(form.furnished)
  const inSite = booleanOrUndefined(form.inSite)
  if (furnished !== undefined) filters.furnished = furnished
  if (inSite !== undefined) filters.inSite = inSite
  return filters
}

export function formFromApartmentFilters(filters: ApartmentFeedFilters): ApartmentFeedFormValues {
  return {
    q: filters.q ?? '',
    provinceId: filters.provinceId ?? '',
    districtId: filters.districtId ?? '',
    roomCount: filters.roomCount ?? '',
    minPrice: filters.minPrice === undefined ? '' : String(filters.minPrice),
    maxPrice: filters.maxPrice === undefined ? '' : String(filters.maxPrice),
    minGrossM2: filters.minGrossM2 === undefined ? '' : String(filters.minGrossM2),
    maxGrossM2: filters.maxGrossM2 === undefined ? '' : String(filters.maxGrossM2),
    maxBuildingAge: filters.maxBuildingAge === undefined ? '' : String(filters.maxBuildingAge),
    heating: filters.heating ?? '',
    parking: filters.parking ?? '',
    furnished: filters.furnished === undefined ? '' : String(filters.furnished),
    inSite: filters.inSite === undefined ? '' : String(filters.inSite),
  }
}

export function parseApartmentFeedQuery(params: URLSearchParams): {
  transactionType: ApartmentTransactionType
  sort: PublicApartmentListingSort
  filters: ApartmentFeedFilters
} {
  const transactionType: ApartmentTransactionType = params.get('transactionType') === 'rent'
    ? 'rent'
    : 'sale'
  const rawSort = params.get('sort')
  const sort = apartmentSortValues.includes(rawSort as PublicApartmentListingSort)
    ? rawSort as PublicApartmentListingSort
    : 'newest'
  const filters: ApartmentFeedFilters = { transactionType }

  const q = params.get('q')
  const provinceId = params.get('provinceId')
  const districtId = params.get('districtId')
  const roomCount = params.get('roomCount')
  const heating = params.get('heating')
  const parking = params.get('parking')
  if (q) filters.q = q
  if (provinceId) filters.provinceId = provinceId
  if (districtId) filters.districtId = districtId
  if (apartmentRoomCounts.includes(roomCount as ApartmentRoomCount)) {
    filters.roomCount = roomCount as ApartmentRoomCount
  }
  if (apartmentHeatingValues.includes(heating as ApartmentHeating)) {
    filters.heating = heating as ApartmentHeating
  }
  if (apartmentParkingValues.includes(parking as ApartmentParking)) {
    filters.parking = parking as ApartmentParking
  }

  for (const key of [
    'minPrice',
    'maxPrice',
    'minGrossM2',
    'maxGrossM2',
    'maxBuildingAge',
  ] as const) {
    const value = params.get(key)
    const parsed = value === null ? undefined : numberOrUndefined(value)
    if (parsed !== undefined) filters[key] = parsed
  }

  for (const key of ['furnished', 'inSite'] as const) {
    const value = booleanOrUndefined(params.get(key) ?? '')
    if (value !== undefined) filters[key] = value
  }

  return { transactionType, sort, filters }
}

export function toApartmentFeedSearchParams(
  transactionType: ApartmentTransactionType,
  sort: PublicApartmentListingSort,
  filters: ApartmentFeedFilters,
): URLSearchParams {
  const params = new URLSearchParams()
  if (transactionType === 'rent') params.set('transactionType', 'rent')
  if (sort !== 'newest') params.set('sort', sort)
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'transactionType' || value === undefined || value === '') continue
    params.set(key, String(value))
  }
  return params
}

export function activeApartmentFilterCount(filters: ApartmentFeedFilters): number {
  return Object.keys(filters).filter((key) => key !== 'transactionType').length
}

export function validateApartmentFeedForm(form: ApartmentFeedFormValues): string | null {
  const minPrice = numberOrUndefined(form.minPrice)
  const maxPrice = numberOrUndefined(form.maxPrice)
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return 'Minimum fiyat maksimum fiyattan büyük olamaz.'
  }
  const minGrossM2 = numberOrUndefined(form.minGrossM2)
  const maxGrossM2 = numberOrUndefined(form.maxGrossM2)
  if (minGrossM2 !== undefined && maxGrossM2 !== undefined && minGrossM2 > maxGrossM2) {
    return 'Minimum m² maksimum m²den büyük olamaz.'
  }
  const maxBuildingAge = numberOrUndefined(form.maxBuildingAge)
  if (maxBuildingAge !== undefined && maxBuildingAge < 0) {
    return 'Maksimum bina yaşı negatif olamaz.'
  }
  return null
}
