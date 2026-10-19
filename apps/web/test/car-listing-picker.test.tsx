import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CarListingPage from '../app/ilan-ver/otomobil/page.js'

describe('car listing picker page', () => {
  it('renders vehicle selection followed by the focused core listing details step', () => {
    const html = renderToStaticMarkup(<CarListingPage />)

    expect(html).toContain('Satılık otomobil ilanı')
    expect(html).toContain('Marka')
    expect(html).toContain('Seri')
    expect(html).toContain('Araç detayını seç')
    expect(html).toContain('İlan taslağını oluştur')

    expect(html).toContain('İlan bilgileri')
    expect(html).toContain('İlan başlığı')
    expect(html).toContain('Model yılı')
    expect(html).toContain('Kilometre')
    expect(html).toContain('Fiyat')
    expect(html).toContain('İl')
    expect(html).toContain('İlçe')
    expect(html).toContain('Mahalle')
    expect(html).toContain('Açıklama')
    expect(html).toContain('Yakıt')
    expect(html).toContain('Vites')
    expect(html).toContain('Araç durumu')
    expect(html).toContain('Kasa tipi')
    expect(html).toContain('Motor gücü')
    expect(html).toContain('Motor hacmi')
    expect(html).toContain('Çekiş')
    expect(html).toContain('Renk')
    expect(html).toContain('Garanti')
    expect(html).toContain('Ağır hasar kaydı')
    expect(html).toContain('Plaka / uyruk')
    expect(html).toContain('Takas')
    expect(html).toContain('Boya durumu')
    expect(html).toContain('Değişen parça')
    expect(html).toContain('İletişim telefonu')
    expect(html).toContain('Fotoğraflar')
    expect(html).toContain('Fotoğraf ekle')
    expect(html).toContain('İlanı kaydet')
  })
})
