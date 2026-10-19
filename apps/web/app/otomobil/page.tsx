import Link from 'next/link'
import { PublicCarListings } from '../components/public-car-listings'

export default function CarsPage() {
  return (
    <main className="market-shell">
      <header className="market-header">
        <Link className="wordmark market-wordmark" href="/">bizzat</Link>
        <nav className="market-nav" aria-label="Ana menü">
          <Link href="/">Ana sayfa</Link>
          <Link className="market-primary-link" href="/ilan-ver/otomobil">İlan ver</Link>
        </nav>
      </header>

      <section className="catalog-intro">
        <p className="listing-create-eyebrow">Otomobil</p>
        <h1>Satılık otomobiller</h1>
        <p>Bireysel satıcıların yayınladığı otomobil ilanlarını tek yerde incele.</p>
      </section>

      <section className="market-section catalog-section">
        <div className="catalog-toolbar">
          <span>En güncel ilanlar</span>
          <span>Fiyat, yıl ve araç bilgileri kart üzerinde</span>
        </div>
        <PublicCarListings limit={24} />
      </section>
    </main>
  )
}
