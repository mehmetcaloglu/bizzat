import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CarListingPage from '../app/ilan-ver/otomobil/page.js'

describe('car listing picker page', () => {
  it('renders the focused canonical vehicle selection flow without future listing fields', () => {
    const html = renderToStaticMarkup(<CarListingPage />)

    expect(html).toContain('Satılık otomobil ilanı')
    expect(html).toContain('Marka')
    expect(html).toContain('Seri')
    expect(html).toContain('Araç detayını seç')
    expect(html).toContain('İlan taslağını oluştur')

    expect(html).not.toContain('Kilometre')
    expect(html).not.toContain('Fiyat')
    expect(html).not.toContain('Fotoğraf')
  })
})
