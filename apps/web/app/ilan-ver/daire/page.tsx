import { ApartmentListingForm } from '../../components/apartment-listing-form'
import { MarketHeader } from '../../components/market-header'

export default function CreateApartmentPage() {
  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro listing-create-intro">
        <p className="listing-create-eyebrow">Daire ilanı</p>
        <h1>Daireni bireysel olarak yayınla</h1>
        <p>Satılık veya kiralık daire bilgilerini gir, fotoğraflarını ekle ve yayınla.</p>
      </section>

      <section className="market-section catalog-section">
        <ApartmentListingForm />
      </section>
    </main>
  )
}
