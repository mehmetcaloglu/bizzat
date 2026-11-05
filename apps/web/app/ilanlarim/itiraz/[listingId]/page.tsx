import Link from 'next/link'
import { MarketHeader } from '../../../components/market-header'
import { ListingAppealForm } from '../../../components/listing-appeal-form'

interface ListingAppealPageProps {
  params: Promise<{ listingId: string }>
}

export default async function ListingAppealPage({ params }: ListingAppealPageProps) {
  const { listingId } = await params

  return (
    <main className="market-shell">
      <MarketHeader />

      <section className="catalog-intro my-listings-intro">
        <div>
          <p className="listing-create-eyebrow">İtiraz</p>
          <h1>Reddedilen ilanın için itiraz et</h1>
          <p>Red kararının neden yeniden incelenmesi gerektiğini moderatör ekibine anlat.</p>
        </div>
        <div className="my-listings-cta-group">
          <Link className="market-cta market-cta-secondary" href="/ilanlarim">İlanlarıma dön</Link>
        </div>
      </section>

      <section className="market-section catalog-section">
        <ListingAppealForm listingId={listingId} />
      </section>
    </main>
  )
}
