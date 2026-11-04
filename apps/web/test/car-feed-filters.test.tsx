import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CarFeedFiltersView } from '../app/components/car-feed-filters-view'
import { emptyCarFeedForm } from '../app/components/car-feed-query'

function renderFilters(overrides: Partial<Parameters<typeof CarFeedFiltersView>[0]> = {}) {
  return renderToStaticMarkup(
    <CarFeedFiltersView
      values={{ ...emptyCarFeedForm, brandId: 'brand-1', provinceId: 'province-1' }}
      brands={[{ id: 'brand-1', name: 'Renault' }]}
      series={[{ id: 'series-1', name: 'Clio' }]}
      models={[{ id: 'model-1', name: '1.0 TCe' }]}
      provinces={[{ id: 'province-1', name: 'İstanbul' }]}
      districts={[{ id: 'district-1', name: 'Güngören' }]}
      loadingSeries={false}
      loadingModels={false}
      loadingDistricts={false}
      activeCount={2}
      error={null}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onClear={() => undefined}
      {...overrides}
    />,
  )
}

describe('car feed filters', () => {
  it('renders cascading vehicle, location, price, and attribute filters', () => {
    const html = renderFilters()

    expect(html).toContain('Filtreler')
    expect(html).toContain('2 aktif')
    expect(html).toContain('Tüm markalar')
    expect(html).toContain('Renault')
    expect(html).toContain('Tüm seriler')
    expect(html).toContain('Clio')
    expect(html).toContain('Tüm modeller')
    expect(html).toContain('1.0 TCe')
    expect(html).toContain('Tüm Türkiye')
    expect(html).toContain('İstanbul')
    expect(html).toContain('Tüm ilçeler')
    expect(html).toContain('Güngören')
    expect(html).toContain('Min fiyat')
    expect(html).toContain('Max KM')
    expect(html).toContain('Yakıt')
    expect(html).toContain('Son 7 gün')
    expect(html).toContain('Filtrele')
    expect(html).toContain('Temizle')
  })

  it('shows a validation error without an active count when filters are empty', () => {
    const html = renderFilters({
      values: emptyCarFeedForm,
      activeCount: 0,
      error: 'Minimum fiyat maksimum fiyattan büyük olamaz.',
    })

    expect(html).toContain('Minimum fiyat maksimum fiyattan büyük olamaz.')
    expect(html).not.toContain('aktif')
    expect(html).not.toContain('Temizle')
  })
})
