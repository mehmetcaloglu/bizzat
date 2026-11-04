import Link from 'next/link'
import { MarketHeader } from './components/market-header'
import { PublicCarListings } from './components/public-car-listings'

export default function HomePage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="market-hero">
        <div className="market-hero-copy">
          <p className="listing-create-eyebrow">Bireyselden bireysele</p>
          <h1>Aradığın ilanı doğrudan sahibinden bul.</h1>
          <p>
            Galerici ve profesyonel mağaza kalabalığı olmadan, bireysel otomobil ilanlarını
            sade bir deneyimle keşfet.
          </p>
          <div className="market-hero-actions">
            <Link className="market-cta" href="/otomobil">Otomobillere bak</Link>
            <Link className="market-secondary-cta" href="/ilan-ver/otomobil">Aracını ilan ver</Link>
          </div>
        </div>
        <div className="market-hero-panel">
          <span>Bireysel otomobil ilanları</span>
          <strong>Satılık otomobil</strong>
          <p>Marka-model seçimi, ilan bilgileri, fotoğraflar ve bireysel iletişim tek akışta.</p>
        </div>
      </section>

      <section className="market-section">
        <div className="market-section-heading">
          <div>
            <p className="listing-create-eyebrow">Yeni ilanlar</p>
            <h2>Son otomobil ilanları</h2>
          </div>
          <Link href="/otomobil">Tümünü gör →</Link>
        </div>
        <PublicCarListings limit={6} />
      </section>

      <section className="market-trust-strip" aria-label="Bizzat yaklaşımı">
        <div><strong>Bireysel odak</strong><span>Profesyonel mağaza hesabı yok.</span></div>
        <div><strong>Açık bilgi</strong><span>Temel araç ve konum bilgileri net görünür.</span></div>
        <div><strong>Doğrudan iletişim</strong><span>İlan sahibi isterse telefonunu gösterir.</span></div>
      </section>
    </main>
  )
}
