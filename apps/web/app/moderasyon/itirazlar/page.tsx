import Link from 'next/link'
import { MarketHeader } from '../../components/market-header'
import { ModerationAppeals } from '../../components/moderation-appeals'

export default function ModerationAppealsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro moderation-intro">
        <p className="listing-create-eyebrow">Moderasyon</p>
        <h1>İtirazlar</h1>
        <p>Reddedilen ilan sahiplerinin itirazlarını incele; kabul edersen ilan yeniden yayına alınır.</p>
        <Link className="market-cta market-cta-secondary" href="/moderasyon/raporlar">
          Rapor kuyruğuna dön
        </Link>
      </section>

      <section className="market-section catalog-section">
        <ModerationAppeals />
      </section>
    </main>
  )
}
