import { describe, expect, it } from 'vitest'
import {
  activeApartmentFilterCount,
  emptyApartmentFeedForm,
  filtersFromApartmentForm,
  formFromApartmentFilters,
  parseApartmentFeedQuery,
  toApartmentFeedSearchParams,
  validateApartmentFeedForm,
} from '../app/components/apartment-feed-query'

describe('apartment feed query state', () => {
  it('parses transaction type, sort, and filter values from the URL', () => {
    const parsed = parseApartmentFeedQuery(new URLSearchParams(
      'transactionType=rent&sort=price_asc&provinceId=province-1&districtId=district-1&roomCount=2%2B1&minPrice=10000&maxPrice=50000&minGrossM2=80&maxGrossM2=120&maxBuildingAge=10&floorLabel=attic&heating=combi&parking=closed&furnished=true&inSite=false&q=geni%C5%9F',
    ))

    expect(parsed.transactionType).toBe('rent')
    expect(parsed.sort).toBe('price_asc')
    expect(parsed.filters).toEqual({
      transactionType: 'rent',
      q: 'geniş',
      provinceId: 'province-1',
      districtId: 'district-1',
      roomCount: '2+1',
      minPrice: 10000,
      maxPrice: 50000,
      minGrossM2: 80,
      maxGrossM2: 120,
      maxBuildingAge: 10,
      floorLabel: 'attic',
      heating: 'combi',
      parking: 'closed',
      furnished: true,
      inSite: false,
    })
  })

  it('falls back to sale and newest for invalid values and ignores invalid enums', () => {
    const parsed = parseApartmentFeedQuery(new URLSearchParams(
      'transactionType=unknown&sort=nope&roomCount=invalid&heating=invalid&parking=invalid',
    ))

    expect(parsed.transactionType).toBe('sale')
    expect(parsed.sort).toBe('newest')
    expect(parsed.filters).toEqual({ transactionType: 'sale' })
  })

  it('builds form filters and round-trips them through the URL', () => {
    const form = {
      ...emptyApartmentFeedForm,
      q: 'Bahçeli',
      roomCount: '3+1',
      minPrice: '3000000',
      maxBuildingAge: '5',
      floorLabel: 'garden',
      heating: 'combi',
      furnished: 'false',
      inSite: 'true',
    }
    const filters = filtersFromApartmentForm('sale', form)

    expect(filters).toEqual({
      transactionType: 'sale',
      q: 'Bahçeli',
      roomCount: '3+1',
      minPrice: 3000000,
      maxBuildingAge: 5,
      floorLabel: 'garden',
      heating: 'combi',
      furnished: false,
      inSite: true,
    })
    expect(formFromApartmentFilters(filters)).toMatchObject({
      q: 'Bahçeli',
      roomCount: '3+1',
      minPrice: '3000000',
      maxBuildingAge: '5',
      floorLabel: 'garden',
      heating: 'combi',
      furnished: 'false',
      inSite: 'true',
    })

    const params = toApartmentFeedSearchParams('sale', 'gross_m2_desc', filters)
    expect(Object.fromEntries(params)).toMatchObject({
      sort: 'gross_m2_desc',
      q: 'Bahçeli',
      roomCount: '3+1',
      minPrice: '3000000',
      maxBuildingAge: '5',
      floorLabel: 'garden',
      heating: 'combi',
      furnished: 'false',
      inSite: 'true',
    })
    expect(parseApartmentFeedQuery(params).filters).toEqual(filters)
  })

  it('omits default sort and sale transaction type from the URL', () => {
    const params = toApartmentFeedSearchParams('sale', 'newest', { transactionType: 'sale' })
    expect(params.toString()).toBe('')

    const rentParams = toApartmentFeedSearchParams('rent', 'newest', { transactionType: 'rent' })
    expect(rentParams.get('transactionType')).toBe('rent')
  })

  it('counts active filters and validates inverted ranges', () => {
    expect(activeApartmentFilterCount({ transactionType: 'sale' })).toBe(0)
    expect(activeApartmentFilterCount({
      transactionType: 'sale',
      provinceId: 'province-1',
      minGrossM2: 80,
    })).toBe(2)

    expect(validateApartmentFeedForm({
      ...emptyApartmentFeedForm,
      minPrice: '200',
      maxPrice: '100',
    })).toBe('Minimum fiyat maksimum fiyattan büyük olamaz.')

    expect(validateApartmentFeedForm({
      ...emptyApartmentFeedForm,
      minGrossM2: '120',
      maxGrossM2: '90',
    })).toBe('Minimum m² maksimum m²den büyük olamaz.')

    expect(validateApartmentFeedForm({
      ...emptyApartmentFeedForm,
      maxBuildingAge: '-1',
    })).toBe('Maksimum bina yaşı negatif olamaz.')

    expect(validateApartmentFeedForm(emptyApartmentFeedForm)).toBeNull()
  })
})
