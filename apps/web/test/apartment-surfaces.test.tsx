import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ApartmentsPage from '../app/daire/page.js'
import CreateListingPage from '../app/ilan-ver/page.js'
import CreateApartmentPage from '../app/ilan-ver/daire/page.js'
import { PublicApartmentCard } from '../app/components/public-apartment-listings'
import type { PublicApartmentListingItem } from '../lib/api-client'

const item: PublicApartmentListingItem = {
  id: '0199f000-0000-7000-8000-000000000001',
  type: 'apartment_sale',
  title: '2+1 geniş daire',
  priceAmount: 4_250_000,
  currency: 'TRY',
  roomCount: '2+1',
  grossM2: 105,
  netM2: 90,
  buildingAge: 5,
  floor: 3,
  location: { provinceName: 'İstanbul', districtName: 'Güngören' },
  attributes: {
    roomCount: '2+1',
    grossM2: 105,
    netM2: 90,
    buildingAge: 5,
    floor: 3,
    totalFloors: 8,
    heating: 'combi',
    bathroomCount: 1,
    kitchen: 'closed',
    balcony: true,
    elevator: true,
    parking: 'closed',
    furnished: false,
    occupancy: 'empty',
    inSite: true,
    deedStatus: 'condominium',
    creditEligible: true,
    swapAvailable: false,
    depositAmount: null,
  },
  imageUrl: null,
}

describe('apartment surfaces', () => {
  it('renders the apartment feed page and category navigation', () => {
    const html = renderToStaticMarkup(<ApartmentsPage />)

    expect(html).toContain('Satılık ve kiralık daireler')
    expect(html).toContain('Daireler')
    expect(html).toContain('Satılık ve kiralık daireler')
    expect(html).toContain('Filtreler hazırlanıyor…')
    expect(html).toContain('Daire ilanı ver')
  })

  it('renders the listing category selection with both verticals', () => {
    const html = renderToStaticMarkup(<CreateListingPage />)

    expect(html).toContain('Satılık otomobil')
    expect(html).toContain('Satılık veya kiralık daire')
    expect(html).toContain('Otomobil')
    expect(html).toContain('Daire')
  })

  it('renders the apartment form shell', () => {
    const html = renderToStaticMarkup(<CreateApartmentPage />)

    expect(html).toContain('Daireni bireysel olarak yayınla')
    expect(html).toContain('İlan formu hazırlanıyor…')
  })

  it('renders an apartment card with sale price and room facts', () => {
    const html = renderToStaticMarkup(<PublicApartmentCard item={item} />)

    expect(html).toContain('2+1 geniş daire')
    expect(html).toContain('Satılık')
    expect(html).toContain('Güngören')
    expect(html).toContain('2+1')
    expect(html).toContain('105 m²')
    expect(html).toContain('4.250.000 TL')
    expect(html).toContain('href="/daire/0199f000-0000-7000-8000-000000000001"')
  })
})
