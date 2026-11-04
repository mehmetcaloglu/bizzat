import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MyListingsPage from '../app/ilanlarim/page'
import { MyListingsView } from '../app/components/my-listings-view'
import type { OwnerCarListingSummary } from '../lib/api-client'

const baseListing: OwnerCarListingSummary = {
  id: '0199f000-0000-7000-8000-000000000001',
  type: 'car_sale',
  status: 'draft',
  title: '2024 Renault Clio temiz aile aracı',
  priceAmount: 1250000,
  currency: 'TRY',
  modelYear: 2024,
  mileageKm: 42800,
  vehicle: {
    brandName: 'Renault',
    seriesName: 'Clio',
    modelName: '1.0 TCe Evolution',
  },
  location: {
    provinceName: 'İstanbul',
    districtName: 'Güngören',
  },
  imageUrl: null,
  updatedAt: '2026-11-04T12:00:00.000Z',
  publishedAt: null,
}

const listings: OwnerCarListingSummary[] = [
  baseListing,
  {
    ...baseListing,
    id: '0199f000-0000-7000-8000-000000000002',
    status: 'published',
    imageUrl: '/api/v1/listings/0199f000-0000-7000-8000-000000000002/images/0199f000-0000-7000-8000-000000000012',
    publishedAt: '2026-11-04T13:00:00.000Z',
  },
  {
    ...baseListing,
    id: '0199f000-0000-7000-8000-000000000003',
    status: 'inactive',
    publishedAt: '2026-11-04T14:00:00.000Z',
  },
]

describe('my listings', () => {
  it('renders draft, published, and inactive listings with their actions', () => {
    const html = renderToStaticMarkup(
      <MyListingsView
        listings={listings}
        loadingActionId={null}
        actionError={null}
        onPublish={() => undefined}
        onUnpublish={() => undefined}
      />,
    )

    expect(html).toContain('Taslak')
    expect(html).toContain('Yayında')
    expect(html).toContain('Yayından kaldırıldı')
    expect(html).toContain('2024 Renault Clio temiz aile aracı')
    expect(html).toContain('1.250.000 TL')
    expect(html).toContain('İstanbul · Güngören')
    expect(html).toContain('Düzenle')
    expect(html).toContain('href="/ilan-ver/otomobil?draft=0199f000-0000-7000-8000-000000000001"')
    expect(html).toContain('href="/ilan-ver/otomobil?draft=0199f000-0000-7000-8000-000000000002"')
    expect(html).toContain('href="/ilan-ver/otomobil?draft=0199f000-0000-7000-8000-000000000003"')
    expect(html).toContain('Yayınla')
    expect(html).toContain('Yayından kaldır')
    expect(html).toContain('href="/otomobil/0199f000-0000-7000-8000-000000000002"')
  })

  it('renders a clear empty state and the page shell', () => {
    const empty = renderToStaticMarkup(
      <MyListingsView
        listings={[]}
        loadingActionId={null}
        actionError={null}
        onPublish={() => undefined}
        onUnpublish={() => undefined}
      />,
    )
    expect(empty).toContain('Henüz otomobil ilanın yok.')

    const page = renderToStaticMarkup(<MyListingsPage />)
    expect(page).toContain('İlanlarım')
    expect(page).toContain('Otomobil ilanı ver')
    expect(page).toContain('Daire ilanı ver')
  })

  it('shows action loading and error state without losing the listing', () => {
    const html = renderToStaticMarkup(
      <MyListingsView
        listings={[baseListing]}
        loadingActionId={baseListing.id}
        actionError="İlanı yayınlamak için en az bir fotoğraf ekle."
        onPublish={() => undefined}
        onUnpublish={() => undefined}
      />,
    )

    expect(html).toContain('Yayınlanıyor…')
    expect(html).toContain('İlanı yayınlamak için en az bir fotoğraf ekle.')
    expect(html).toContain('2024 Renault Clio temiz aile aracı')
  })
})
