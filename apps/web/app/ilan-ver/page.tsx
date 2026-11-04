import Link from 'next/link'
import { MarketHeader } from '../components/market-header'

export default function CreateListingPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro">
        <p className="listing-create-eyebrow">İlan ver</p>
        <h1>Ne yayınlamak istiyorsun?</h1>
        <p>Otomobil veya daire ilanını bireysel olarak oluştur.</p>
      </section>

      <section className="market-section catalog-section">
        <div className="listing-category-grid">
          <Link className="listing-category-card" href="/ilan-ver/otomobil">
            <span>Vasıta</span>
            <strong>Satılık otomobil</strong>
            <p>Marka, model ve araç bilgileriyle otomobil ilanı oluştur.</p>
          </Link>
          <Link className="listing-category-card" href="/ilan-ver/daire">
            <span>Emlak</span>
            <strong>Satılık veya kiralık daire</strong>
            <p>Oda sayısı, metrekare ve konum bilgileriyle daire ilanı oluştur.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
