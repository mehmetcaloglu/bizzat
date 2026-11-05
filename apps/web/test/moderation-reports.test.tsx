import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ModerationReportsPage from '../app/moderasyon/raporlar/page'
import { ModerationReportsView } from '../app/components/moderation-reports-view'
import type { ModerationReport, ModerationReportListResponse } from '../lib/api-client'

const report: ModerationReport = {
  id: '0199f000-0000-7000-8000-000000000001',
  listingId: '0199f000-0000-7000-8000-000000000002',
  reason: 'fraud',
  note: 'Fiyat ve açıklama şüpheli görünüyor.',
  status: 'open',
  reporterType: 'member',
  createdAt: '2026-11-04T13:00:00.000Z',
  slaDueAt: '2026-11-05T13:00:00.000Z',
  slaState: 'on_track',
  listing: {
    type: 'car_sale',
    title: '2024 Renault Clio temiz aile aracı',
    status: 'published',
    priceAmount: 1250000,
    currency: 'TRY',
    provinceName: 'İstanbul',
    districtName: 'Güngören',
    imageUrl: '/api/v1/listings/public/images/0199f000-0000-7000-8000-000000000012',
  },
}

const summary: ModerationReportListResponse['summary'] = {
  slaHours: 24,
  openCount: 1,
  overdueCount: 0,
  dueSoonCount: 0,
  oldestOpenCreatedAt: '2026-11-04T13:00:00.000Z',
}

function renderReports(
  reports: ModerationReport[],
  reportSummary: ModerationReportListResponse['summary'] = summary,
) {
  return renderToStaticMarkup(
    <ModerationReportsView
      reports={reports}
      summary={reportSummary}
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
    expect(html).toContain('Açık rapor')
    expect(html).toContain('Yanıt hedefi')
  })

  it('renders overdue SLA state and an apartment-aware listing link', () => {
    const html = renderReports([
      {
        ...report,
        slaState: 'overdue',
        slaDueAt: '2026-11-05T09:00:00.000Z',
        listing: { ...report.listing, type: 'apartment_sale' },
      },
    ], {
      ...summary,
      openCount: 1,
      overdueCount: 1,
    })

    expect(html).toContain('SLA gecikti')
    expect(html).toContain('Geciken')
    expect(html).toContain('href="/daire/0199f000-0000-7000-8000-000000000002"')
  })

  it('renders a clear empty queue and the page shell', () => {
    const empty = renderReports([], {
      slaHours: 24,
      openCount: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      oldestOpenCreatedAt: null,
    })
    expect(empty).toContain('Bekleyen rapor yok.')

    const page = renderToStaticMarkup(<ModerationReportsPage />)
    expect(page).toContain('Bekleyen raporlar')
    expect(page).toContain('Moderasyon')
  })
})
