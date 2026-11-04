import { Suspense } from 'react'
import { CarFeed } from '../components/car-feed'
import { MarketHeader } from '../components/market-header'

export default function CarsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro">
        <p className="listing-create-eyebrow">Otomobil</p>
        <h1>Satılık otomobiller</h1>
        <p>Bireysel satıcıların yayınladığı otomobil ilanlarını filtrele, sırala ve incele.</p>
      </section>

      <section className="market-section catalog-section">
        <Suspense fallback={(
          <div className="public-list-state">
            <strong>Filtreler hazırlanıyor…</strong>
            <span>İlan listesi birazdan yüklenecek.</span>
          </div>
        )}>
          <CarFeed limit={12} />
        </Suspense>
      </section>
    </main>
  )
}
