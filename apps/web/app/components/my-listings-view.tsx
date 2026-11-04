import Link from 'next/link'
import type {
  OwnerCarListingStatus,
  OwnerCarListingSummary,
} from '../../lib/api-client'

const statusLabels: Record<OwnerCarListingStatus, string> = {
  draft: 'Taslak',
  pending_verification: 'Doğrulanıyor',
  pending_review: 'İnceleme bekliyor',
  published: 'Yayında',
  rejected: 'Reddedildi',
  inactive: 'Yayından kaldırıldı',
}

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' TL'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function locationLabel(listing: OwnerCarListingSummary): string {
  const parts = [listing.location.provinceName, listing.location.districtName]
    .filter((value): value is string => Boolean(value))
  return parts.length > 0 ? parts.join(' · ') : 'Konum eklenmedi'
}

interface MyListingsViewProps {
  listings: OwnerCarListingSummary[]
  loadingActionId: string | null
  actionError: string | null
  onPublish: (listingId: string) => void
  onUnpublish: (listingId: string) => void
}

export function MyListingsView({
  listings,
  loadingActionId,
  actionError,
  onPublish,
  onUnpublish,
}: MyListingsViewProps) {
  if (listings.length === 0) {
    return (
      <div className="public-list-state my-listings-empty">
        <strong>Henüz bir ilanın yok.</strong>
        <span>İlk otomobil ilanını oluşturarak başlayabilirsin.</span>
        <Link href="/ilan-ver/otomobil">İlan ver</Link>
      </div>
    )
  }

  return (
    <div className="my-listings">
      {actionError && (
        <div className="listing-error" role="alert">{actionError}</div>
      )}

      <div className="my-listings-grid">
        {listings.map((listing) => {
          const title = listing.title ?? 'Taslak ilan'
          const actionLoading = loadingActionId === listing.id
          const canPublish = listing.status === 'draft' || listing.status === 'inactive'
          const canUnpublish = listing.status === 'published'

          return (
            <article className="my-listing-card" key={listing.id}>
              <div className="my-listing-media">
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt={title} />
                ) : (
                  <span aria-hidden="true">{listing.vehicle.brandName.slice(0, 1)}</span>
                )}
              </div>

              <div className="my-listing-body">
                <div className="my-listing-topline">
                  <span className={`listing-status listing-status-${listing.status}`}>
                    {statusLabels[listing.status]}
                  </span>
                  <span>{formatDate(listing.updatedAt)}</span>
                </div>

                <h2>{title}</h2>
                <p className="my-listing-vehicle">
                  {listing.vehicle.brandName} · {listing.vehicle.seriesName} · {listing.vehicle.modelName}
                </p>
                <p className="my-listing-location">{locationLabel(listing)}</p>

                <div className="my-listing-facts">
                  <strong>
                    {listing.priceAmount === null
                      ? 'Fiyat girilmedi'
                      : formatTry(listing.priceAmount)}
                  </strong>
                  <span>
                    {listing.modelYear === null ? 'Yıl girilmedi' : listing.modelYear}
                    {' · '}
                    {listing.mileageKm === null
                      ? 'Km girilmedi'
                      : `${new Intl.NumberFormat('tr-TR').format(listing.mileageKm)} km`}
                  </span>
                </div>

                <div className="my-listing-actions">
                  {listing.status === 'draft' && (
                    <Link
                      className="my-listing-secondary"
                      href={`/ilan-ver/otomobil?draft=${listing.id}`}
                    >
                      Düzenle
                    </Link>
                  )}

                  {canPublish && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => onPublish(listing.id)}
                    >
                      {actionLoading ? 'Yayınlanıyor…' : 'Yayınla'}
                    </button>
                  )}

                  {canUnpublish && (
                    <>
                      <Link className="my-listing-secondary" href={`/otomobil/${listing.id}`}>
                        İlanı gör
                      </Link>
                      <button
                        className="my-listing-secondary"
                        type="button"
                        disabled={actionLoading}
                        onClick={() => onUnpublish(listing.id)}
                      >
                        {actionLoading ? 'Kaldırılıyor…' : 'Yayından kaldır'}
                      </button>
                    </>
                  )}

                  {listing.status === 'pending_verification' && (
                    <span className="my-listing-note">EİDS doğrulaması sürüyor.</span>
                  )}
                  {listing.status === 'pending_review' && (
                    <span className="my-listing-note">İlan inceleme sırasında.</span>
                  )}
                  {listing.status === 'rejected' && (
                    <span className="my-listing-note">İlan reddedildi. Destek ekibiyle iletişime geç.</span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
