import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ModerationReportsPage from '../app/moderasyon/raporlar/page'
import { ModerationReportsView } from '../app/components/moderation-reports-view'
import type { ModerationReport } from '../lib/api-client'

const report: ModerationReport = {
  id: '0199f000-0000-7000-8000-000000000001',
  listingId: '0199f000-0000-7000-8000-000000000002',
  reason: 'fraud',
  note: 'Fiyat ve açıklama şüpheli görünüyor.',
  status: 'open',
  reporterType: 'member',
  createdAt: '2026-11-04T13:00:00.000Z',
  listing: {
    title: '2024 Renault Clio temiz aile aracı',
    status: 'published',
    priceAmount: 1250000,
    currency: 'TRY',
    provinceName: 'İstanbul',
    districtName: 'Güngören',
    imageUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000012',
  },
}

function renderReports(reports: ModerationReport[]) {
  return renderToStaticMarkup(
    <ModerationReportsView
      reports={reports}
      notes={{}}
      loadingActionId={null}
      actionError={null}
      onNoteChange={() => undefined}
      onResolve={() => undefined}
    />,
  )
}

describe('moderation reports', () => {
  it('renders report context, moderation note field, and actions', () => {
    const html = renderReports([report])

    expect(html).toContain('Dolandırıcılık veya şüpheli işlem')
    expect(html).toContain('2024 Renault Clio temiz aile aracı')
    expect(html).toContain('1.250.000 TL')
    expect(html).toContain('İstanbul · Güngören')
    expect(html).toContain('İlan durumu: Yayında')
    expect(html).toContain('Rapor notu:')
    expect(html).toContain('Moderasyon notu (isteğe bağlı)')
    expect(html).toContain('İlanı reddet')
    expect(html).toContain('Raporu reddet')
    expect(html).toContain('href="/otomobil/0199f000-0000-7000-8000-000000000002"')
  })

  it('renders a clear empty queue and the page shell', () => {
    const empty = renderReports([])
    expect(empty).toContain('Bekleyen rapor yok.')

    const page = renderToStaticMarkup(<ModerationReportsPage />)
    expect(page).toContain('Bekleyen raporlar')
    expect(page).toContain('Moderasyon')
  })
})
