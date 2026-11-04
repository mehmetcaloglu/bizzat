import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReportListingForm } from '../app/components/report-listing-form'

describe('report listing form', () => {
  it('renders a collapsed report action by default', () => {
    const html = renderToStaticMarkup(
      <ReportListingForm listingId="0199f000-0000-7000-8000-000000000001" />,
    )

    expect(html).toContain('İlanı raporla')
    expect(html).not.toContain('Raporu gönder')
  })

  it('renders reason options and the optional note field when opened', () => {
    const html = renderToStaticMarkup(
      <ReportListingForm
        listingId="0199f000-0000-7000-8000-000000000001"
        defaultOpen
      />,
    )

    expect(html).toContain('Rapor nedenini seç')
    expect(html).toContain('Dolandırıcılık veya şüpheli işlem')
    expect(html).toContain('Yanlış kategori')
    expect(html).toContain('Yasaklı veya uygunsuz içerik')
    expect(html).toContain('Tekrarlanan ilan')
    expect(html).toContain('Yanıltıcı bilgi veya fotoğraf')
    expect(html).toContain('Ek bilgi (isteğe bağlı)')
    expect(html).toContain('Raporu gönder')
  })
})
