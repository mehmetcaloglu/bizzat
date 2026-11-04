import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  emptyCarFeedForm,
  filtersFromForm,
  formFromFilters,
  parseCarFeedQuery,
  toCarFeedSearchParams,
  validateCarFeedForm,
} from '../app/components/car-feed-query'

describe('car feed query state', () => {
  it('parses sort and filter values from the URL', () => {
    const parsed = parseCarFeedQuery(new URLSearchParams(
      'sort=price_asc&brandId=brand-1&minPrice=1000000&swapAvailable=true&q=Clio',
    ))

    expect(parsed.sort).toBe('price_asc')
    expect(parsed.filters).toEqual({
      q: 'Clio',
      brandId: 'brand-1',
      minPrice: 1000000,
      swapAvailable: true,
    })
  })

  it('falls back to newest for an invalid sort', () => {
    expect(parseCarFeedQuery(new URLSearchParams('sort=nope')).sort).toBe('newest')
  })

  it('builds filters from form values and round-trips them', () => {
    const form = {
      ...emptyCarFeedForm,
      q: 'Egea',
      seriesId: 'series-1',
      minYear: '2022',
      maxMileageKm: '90000',
      swapAvailable: 'false',
      fuelType: 'dizel',
    }
    const filters = filtersFromForm(form)

    expect(filters).toEqual({
      q: 'Egea',
      seriesId: 'series-1',
      fuelType: 'dizel',
      minYear: 2022,
      maxMileageKm: 90000,
      swapAvailable: false,
    })
    expect(formFromFilters(filters)).toMatchObject({
      q: 'Egea',
      seriesId: 'series-1',
      fuelType: 'dizel',
      minYear: '2022',
      maxMileageKm: '90000',
      swapAvailable: 'false',
    })

    const params = toCarFeedSearchParams('year_desc', filters)
    expect(Object.fromEntries(params)).toMatchObject({
      sort: 'year_desc',
      q: 'Egea',
      seriesId: 'series-1',
      fuelType: 'dizel',
      minYear: '2022',
      maxMileageKm: '90000',
      swapAvailable: 'false',
    })
    expect(parseCarFeedQuery(params).filters).toEqual(filters)
  })

  it('counts active filters and rejects inverted ranges', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ brandId: 'brand-1', minPrice: 100 })).toBe(2)

    expect(validateCarFeedForm({
      ...emptyCarFeedForm,
      minPrice: '200',
      maxPrice: '100',
    })).toBe('Minimum fiyat maksimum fiyattan büyük olamaz.')

    expect(validateCarFeedForm({
      ...emptyCarFeedForm,
      minMileageKm: '100',
      maxMileageKm: '200',
    })).toBeNull()
  })
})
