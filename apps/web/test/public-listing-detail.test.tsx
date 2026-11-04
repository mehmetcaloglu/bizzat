import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PublicCarListingCard } from '../app/components/public-car-listings'
import { PublicCarListingDetailView } from '../app/components/public-car-listing-detail-view'
import type { PublicCarListingDetail, PublicCarListingItem } from '../lib/api-client'

const listing: PublicCarListingDetail = {
  id: '0199f000-0000-7000-8000-000000000001',
  title: '2024 Renault Clio Evolution temiz aile aracı',
  description: 'Bakımları zamanında yapılmış, günlük kullanılan temiz ve bireysel aile aracıdır.',
  priceAmount: 1250000,
  currency: 'TRY',
  modelYear: 2024,
  mileageKm: 42800,
  vehicle: {
    brandName: 'Renault',
    seriesName: 'Clio',
    modelName: '1.0 TCe Evolution',
    selectionPath: [
      { key: 'renault:clio:1-0-tce', name: '1.0 TCe' },
      { key: 'renault:clio:1-0-tce:evolution', name: 'Evolution' },
    ],
  },
  location: {
    provinceName: 'İstanbul',
    districtName: 'Güngören',
    neighborhoodName: 'Haznedar',
  },
  attributes: {
    fuelType: 'benzin',
    transmission: 'otomatik',
    vehicleCondition: 'second_hand',
    bodyType: 'hatchback',
    enginePowerHp: 90,
    engineDisplacementCc: 999,
    drivetrain: 'front',
    color: 'Beyaz',
    underWarranty: true,
    heavyDamageRecorded: false,
    plateNationality: 'tr',
    swapAvailable: false,
    paintStatus: 'original',
    replacementStatus: 'none',
  },
  images: [
    {
      id: '0199f000-0000-7000-8000-000000000011',
      sortOrder: 0,
      cardUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000011',
      fullUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000011/full',
    },
    {
      id: '0199f000-0000-7000-8000-000000000012',
      sortOrder: 1,
      cardUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000012',
      fullUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000012/full',
    },
  ],
  contact: {
    showPhone: true,
  },
}

const cardItem: PublicCarListingItem = {
  id: listing.id,
  title: listing.title,
  priceAmount: listing.priceAmount,
  currency: 'TRY',
  modelYear: listing.modelYear,
  mileageKm: listing.mileageKm,
  vehicle: {
    brandName: listing.vehicle.brandName,
    seriesName: listing.vehicle.seriesName,
  },
  location: {
    provinceName: listing.location.provinceName,
    districtName: listing.location.districtName,
  },
  attributes: listing.attributes,
  imageUrl: listing.images[0]!.cardUrl,
}

function renderDetail(overrides: Partial<PublicCarListingDetail> = {}) {
  return renderToStaticMarkup(
    <PublicCarListingDetailView
      listing={{ ...listing, ...overrides }}
      phone={null}
      phoneLoading={false}
      phoneError={null}
      onShowPhone={() => undefined}
    />,
  )
}

describe('public car listing detail', () => {
  it('renders the listing summary, gallery, specifications, description, and contact action', () => {
    const html = renderDetail()

    expect(html).toContain('2024 Renault Clio Evolution temiz aile aracı')
    expect(html).toContain('Renault · Clio · 1.0 TCe · Evolution')
    expect(html).toContain('1.250.000 TL')
    expect(html).toContain('İstanbul')
    expect(html).toContain('Güngören')
    expect(html).toContain('Haznedar')
    expect(html).toContain('42.800 km')
    expect(html).toContain('Benzin')
    expect(html).toContain('Otomatik')
    expect(html).toContain('Bakımları zamanında yapılmış')
    expect(html).toContain('Telefonu göster')
    expect(html).toContain('İlanı raporla')
    expect(html).toContain(listing.images[0]!.fullUrl)
    expect(html).not.toContain('+90 555')
  })

  it('shows a clear message when the owner does not share the phone number', () => {
    const html = renderDetail({ contact: { showPhone: false } })

    expect(html).toContain('İlan sahibi telefon numarasını paylaşmadı.')
    expect(html).not.toContain('Telefonu göster')
  })

  it('renders the phone as a tel link after the visitor reveals it', () => {
    const html = renderToStaticMarkup(
      <PublicCarListingDetailView
        listing={listing}
        phone="+905551234567"
        phoneLoading={false}
        phoneError={null}
        onShowPhone={() => undefined}
      />,
    )

    expect(html).toContain('href="tel:+905551234567"')
    expect(html).toContain('+90 555 123 45 67')
    expect(html).not.toContain('Telefonu göster')
  })

  it('links each public card to its detail page', () => {
    const html = renderToStaticMarkup(<PublicCarListingCard item={cardItem} />)

    expect(html).toContain(`href="/otomobil/${listing.id}"`)
    expect(html).toContain(listing.title)
    expect(html).toContain('1.250.000 TL')
  })
})
