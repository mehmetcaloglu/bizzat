import Link from 'next/link'
import { MarketHeader } from '../components/market-header'
import { MyListings } from '../components/my-listings'

export default function MyListingsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro my-listings-intro">
        <div>
          <p className="listing-create-eyebrow">Hesabım</p>
          <h1>İlanlarım</h1>
          <p>Taslaklarını yayınla, yayındaki ilanlarını yönet ve durumlarını takip et.</p>
        </div>
        <Link className="market-cta" href="/ilan-ver/otomobil">Yeni otomobil ilanı</Link>
      </section>

      <section className="market-section catalog-section">
        <MyListings />
      </section>
    </main>
  )
}
