import { MarketHeader } from '../../components/market-header'
import { PublicCarListingDetail } from '../../components/public-car-listing-detail'

interface CarListingDetailPageProps {
  params: Promise<{ listingId: string }>
}

export default async function CarListingDetailPage({ params }: CarListingDetailPageProps) {
  const { listingId } = await params

  return (
    <main className="market-shell">
      <MarketHeader />
      <section className="listing-detail-shell">
        <PublicCarListingDetail listingId={listingId} />
      </section>
    </main>
  )
}
