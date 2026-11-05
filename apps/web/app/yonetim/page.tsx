import { MarketHeader } from '../components/market-header'
import { SuperAdminConsole } from '../components/super-admin-console'

export default function AdminPage() {
  return (
    <main className="market-shell">
      <MarketHeader />
      <section className="catalog-intro moderation-intro">
        <p className="listing-create-eyebrow">Süper admin</p>
        <h1>Bizzat yönetimi</h1>
        <p>Sistem özetini izle, kullanıcı rollerini yönet ve son yaptırım kayıtlarını denetle.</p>
      </section>
      <section className="market-section catalog-section">
        <SuperAdminConsole />
      </section>
    </main>
  )
}
