import { MarketHeader } from '../components/market-header'
import { PublicCarListings } from '../components/public-car-listings'

export default function CarsPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

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
        <PublicCarListings limit={12} paginated />
      </section>
    </main>
  )
}
