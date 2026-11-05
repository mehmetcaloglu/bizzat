import Link from 'next/link'
import { Suspense } from 'react'
import { MarketHeader } from '../components/market-header'
import { PublicApartmentListings } from '../components/public-apartment-listings'

export default function ApartmentsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro">
        <p className="listing-create-eyebrow">Daire</p>
        <h1>Satılık ve kiralık daireler</h1>
        <p>Bireysel ilanları oda sayısı, metrekare, konum ve bütçene göre filtrele.</p>
      </section>

      <section className="market-section catalog-section">
        <Suspense fallback={(
          <div className="public-list-state">
            <strong>Filtreler hazırlanıyor…</strong>
            <span>Daire listesi birazdan yüklenecek.</span>
          </div>
        )}>
          <PublicApartmentListings limit={12} />
        </Suspense>
        <div className="apartment-create-cta">
          <span>Daireni bireysel olarak yayınlamak ister misin?</span>
          <Link href="/ilan-ver/daire">Daire ilanı ver</Link>
        </div>
      </section>
    </main>
  )
}
