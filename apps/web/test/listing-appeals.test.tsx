import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ModerationAppealsPage from '../app/moderasyon/itirazlar/page'
import { ListingAppealForm } from '../app/components/listing-appeal-form'
import { ModerationAppealsView } from '../app/components/moderation-appeals-view'
import type { ModerationAppeal } from '../lib/api-client'

const appeal: ModerationAppeal = {
  id: '0199f000-0000-7000-8000-000000000101',
  listingId: '0199f000-0000-7000-8000-000000000102',
  status: 'pending',
  note: 'İlanımın reddedilmesi haksız; yeniden incelenmesini istiyorum.',
  createdAt: '2026-11-05T10:00:00.000Z',
  listing: {
    type: 'car_sale',
    title: '2024 Renault Clio temiz aile aracı',
    status: 'rejected',
    priceAmount: 1250000,
    currency: 'TRY',
    provinceName: 'İstanbul',
    districtName: 'Güngören',
    imageUrl: null,
  },
}

describe('listing appeals', () => {
  it('renders the owner appeal form with the single-appeal rule', () => {
    const html = renderToStaticMarkup(
      <ListingAppealForm listingId="0199f000-0000-7000-8000-000000000102" />,
    )

    expect(html).toContain('Neden yeniden incelenmesini istiyorsun?')
    expect(html).toContain('İtirazı gönder')
    expect(html).toContain('Her ilan için yalnızca bir itiraz gönderebilirsin.')
  })

  it('renders appeal context, moderation note, and decisions', () => {
    const html = renderToStaticMarkup(
      <ModerationAppealsView
        appeals={[appeal]}
        notes={{}}
        loadingActionId={null}
        actionError={null}
        onNoteChange={() => undefined}
        onResolve={() => undefined}
      />,
    )

    expect(html).toContain('2024 Renault Clio temiz aile aracı')
    expect(html).toContain('Sahip itirazı:')
    expect(html).toContain('Karar notu (isteğe bağlı)')
    expect(html).toContain('İtirazı kabul et')
    expect(html).toContain('İtirazı reddet')
    expect(html).toContain('İlan durumu: Reddedildi')
  })

  it('renders the moderation appeals page shell', () => {
    const page = renderToStaticMarkup(<ModerationAppealsPage />)
    expect(page).toContain('İtirazlar')
    expect(page).toContain('Rapor kuyruğuna dön')
  })

  it('renders a clear empty appeal queue', () => {
    const html = renderToStaticMarkup(
      <ModerationAppealsView
        appeals={[]}
        notes={{}}
        loadingActionId={null}
        actionError={null}
        onNoteChange={() => undefined}
        onResolve={() => undefined}
      />,
    )
    expect(html).toContain('Bekleyen itiraz yok.')
  })
})
