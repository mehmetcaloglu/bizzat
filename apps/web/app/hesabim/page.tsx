import { MarketHeader } from '../components/market-header'
import { AccountStatusView } from '../components/account-status'

export default function AccountPage() {
  return (
    <main className="market-shell">
      <MarketHeader />
      <section className="catalog-intro my-listings-intro">
        <div>
          <p className="listing-create-eyebrow">Hesabım</p>
          <h1>Hesap durumun</h1>
          <p>Hesap durumunu, uyarıları ve moderasyon işlemlerini burada takip edebilirsin.</p>
        </div>
      </section>
      <section className="market-section catalog-section">
        <AccountStatusView />
      </section>
    </main>
  )
}
