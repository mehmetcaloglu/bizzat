import type {
  PublicCarListingFilters,
  PublicCarListingSort,
} from '../../lib/api-client'

export interface CarFeedFormValues {
  q: string
  brandId: string
  seriesId: string
  modelId: string
  provinceId: string
  districtId: string
  minPrice: string
  maxPrice: string
  minYear: string
  maxYear: string
  minMileageKm: string
  maxMileageKm: string
  fuelType: string
  transmission: string
  bodyType: string
  drivetrain: string
  vehicleCondition: string
  color: string
  swapAvailable: string
  listedWithinDays: string
}

export const emptyCarFeedForm: CarFeedFormValues = {
  q: '',
  brandId: '',
  seriesId: '',
  modelId: '',
  provinceId: '',
  districtId: '',
  minPrice: '',
  maxPrice: '',
  minYear: '',
  maxYear: '',
  minMileageKm: '',
  maxMileageKm: '',
  fuelType: '',
  transmission: '',
  bodyType: '',
  drivetrain: '',
  vehicleCondition: '',
  color: '',
  swapAvailable: '',
  listedWithinDays: '',
}

const sortValues: PublicCarListingSort[] = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'mileage_desc',
  'year_asc',
  'year_desc',
]

const stringFields = [
  'q',
  'brandId',
  'seriesId',
  'modelId',
  'provinceId',
  'districtId',
  'fuelType',
  'transmission',
  'bodyType',
  'drivetrain',
  'vehicleCondition',
  'color',
] as const

const numberFields = [
  'minPrice',
  'maxPrice',
  'minYear',
  'maxYear',
  'minMileageKm',
  'maxMileageKm',
  'listedWithinDays',
] as const

function parseSort(value: string | null): PublicCarListingSort {
  return value && sortValues.includes(value as PublicCarListingSort)
    ? value as PublicCarListingSort
    : 'newest'
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function filtersFromForm(form: CarFeedFormValues): PublicCarListingFilters {
  const filters: PublicCarListingFilters = {}

  for (const field of stringFields) {
    const value = form[field].trim()
    if (value !== '') filters[field] = value
  }
  for (const field of numberFields) {
    const value = parseOptionalNumber(form[field])
    if (value !== undefined) filters[field] = value
  }
  if (form.swapAvailable === 'true') filters.swapAvailable = true
  if (form.swapAvailable === 'false') filters.swapAvailable = false

  return filters
}

export function formFromFilters(filters: PublicCarListingFilters): CarFeedFormValues {
  return {
    q: filters.q ?? '',
    brandId: filters.brandId ?? '',
    seriesId: filters.seriesId ?? '',
    modelId: filters.modelId ?? '',
    provinceId: filters.provinceId ?? '',
    districtId: filters.districtId ?? '',
    minPrice: filters.minPrice === undefined ? '' : String(filters.minPrice),
    maxPrice: filters.maxPrice === undefined ? '' : String(filters.maxPrice),
    minYear: filters.minYear === undefined ? '' : String(filters.minYear),
    maxYear: filters.maxYear === undefined ? '' : String(filters.maxYear),
    minMileageKm: filters.minMileageKm === undefined ? '' : String(filters.minMileageKm),
    maxMileageKm: filters.maxMileageKm === undefined ? '' : String(filters.maxMileageKm),
    fuelType: filters.fuelType ?? '',
    transmission: filters.transmission ?? '',
    bodyType: filters.bodyType ?? '',
    drivetrain: filters.drivetrain ?? '',
    vehicleCondition: filters.vehicleCondition ?? '',
    color: filters.color ?? '',
    swapAvailable: filters.swapAvailable === undefined ? '' : String(filters.swapAvailable),
    listedWithinDays: filters.listedWithinDays === undefined
      ? ''
      : String(filters.listedWithinDays),
  }
}

export function parseCarFeedQuery(params: URLSearchParams): {
  sort: PublicCarListingSort
  filters: PublicCarListingFilters
} {
  const form = { ...emptyCarFeedForm }
  for (const field of [...stringFields, ...numberFields] as const) {
    form[field] = params.get(field) ?? ''
  }
  form.swapAvailable = params.get('swapAvailable') ?? ''

  return {
    sort: parseSort(params.get('sort')),
    filters: filtersFromForm(form),
  }
}

export function toCarFeedSearchParams(
  sort: PublicCarListingSort,
  filters: PublicCarListingFilters,
): URLSearchParams {
  const params = new URLSearchParams()
  if (sort !== 'newest') params.set('sort', sort)
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params
}

export function activeFilterCount(filters: PublicCarListingFilters): number {
  return Object.keys(filters).length
}

function hasInvertedRange(form: CarFeedFormValues, minField: keyof CarFeedFormValues, maxField: keyof CarFeedFormValues) {
  const min = parseOptionalNumber(form[minField])
  const max = parseOptionalNumber(form[maxField])
  return min !== undefined && max !== undefined && min > max
}

export function validateCarFeedForm(form: CarFeedFormValues): string | null {
  if (hasInvertedRange(form, 'minPrice', 'maxPrice')) {
    return 'Minimum fiyat maksimum fiyattan büyük olamaz.'
  }
  if (hasInvertedRange(form, 'minYear', 'maxYear')) {
    return 'Minimum yıl maksimum yıldan büyük olamaz.'
  }
  if (hasInvertedRange(form, 'minMileageKm', 'maxMileageKm')) {
    return 'Minimum kilometre maksimum kilometreden büyük olamaz.'
  }
  return null
}
