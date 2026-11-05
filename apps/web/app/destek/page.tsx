import { MarketHeader } from '../components/market-header'
import { StaffConsole } from '../components/staff-console'

export default function StaffPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro moderation-intro">
        <p className="listing-create-eyebrow">Customer service</p>
        <h1>Destek paneli</h1>
        <p>Kullanıcıları ara; uyarı ver, hesapları askıya al veya banla, kurallara aykırı ilanları kapat.</p>
      </section>

      <section className="market-section catalog-section">
        <StaffConsole />
      </section>
    </main>
  )
}
