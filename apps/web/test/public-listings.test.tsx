import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from '../app/page.js'
import CarsPage from '../app/otomobil/page.js'

describe('public marketplace surfaces', () => {
  it('renders the marketplace homepage', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('Aradığın ilanı doğrudan sahibinden bul.')
    expect(html).toContain('Son otomobil ilanları')
    expect(html).toContain('Otomobillere bak')
    expect(html).toContain('Aracını ilan ver')
  })

  it('renders the public car listing page', () => {
    const html = renderToStaticMarkup(<CarsPage />)

    expect(html).toContain('Satılık otomobiller')
    expect(html).toContain('En güncel ilanlar')
    expect(html).toContain('Fiyat, yıl ve araç bilgileri kart üzerinde')
  })
})
