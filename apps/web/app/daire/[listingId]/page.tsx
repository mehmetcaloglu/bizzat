import { MarketHeader } from '../../components/market-header'
import { PublicApartmentDetail } from '../../components/public-apartment-detail'

export default async function ApartmentDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params

  return (
    <main className="market-shell">
      <MarketHeader />
      <section className="market-section catalog-section">
        <PublicApartmentDetail listingId={listingId} />
      </section>
    </main>
  )
}
