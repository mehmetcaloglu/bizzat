import { MarketHeader } from '../../components/market-header'
import { ModerationReports } from '../../components/moderation-reports'

export default function ModerationReportsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro moderation-intro">
        <p className="listing-create-eyebrow">Moderasyon</p>
        <h1>Bekleyen raporlar</h1>
        <p>Raporları incele; gerekiyorsa ilanı yayından kaldır veya raporu reddet.</p>
      </section>

      <section className="market-section catalog-section">
        <ModerationReports />
      </section>
    </main>
  )
}
