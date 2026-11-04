'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  listMyApartmentListings,
  publishApartmentListing,
  unpublishApartmentListing,
  type ApartmentOwnerListingSummary,
} from '../../lib/api-client'

const statusLabels: Record<ApartmentOwnerListingSummary['status'], string> = {
  draft: 'Taslak',
  pending_verification: 'Doğrulanıyor',
  pending_review: 'İnceleme bekliyor',
  published: 'Yayında',
  rejected: 'Reddedildi',
  inactive: 'Yayından kaldırıldı',
}

function message(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'Daire ilanları yüklenemedi.'
}

export function MyApartmentListings() {
  const [listings, setListings] = useState<ApartmentOwnerListingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listMyApartmentListings()
      .then((response) => {
        if (!cancelled) setListings(response.items)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (loadError instanceof ApiClientError && loadError.status === 401) return
        setError(message(loadError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function publish(id: string) {
    setLoadingActionId(id)
    setActionError(null)
    try {
      const response = await publishApartmentListing(id)
      setListings((current) => current.map((listing) => listing.id === id
        ? { ...listing, status: response.listing.status, publishedAt: response.listing.publishedAt }
        : listing))
    } catch (publishError) {
      setActionError(message(publishError))
    } finally {
      setLoadingActionId(null)
    }
  }

  async function unpublish(id: string) {
    setLoadingActionId(id)
    setActionError(null)
    try {
      const response = await unpublishApartmentListing(id)
      setListings((current) => current.map((listing) => listing.id === id
        ? { ...listing, status: response.listing.status }
        : listing))
    } catch (unpublishError) {
      setActionError(message(unpublishError))
    } finally {
      setLoadingActionId(null)
    }
  }

  if (loading || listings.length === 0) return null

  return (
    <section className="my-apartment-section">
      <div className="market-section-heading">
        <div>
          <p className="listing-create-eyebrow">Emlak</p>
          <h2>Daire ilanlarım</h2>
        </div>
        <Link href="/ilan-ver/daire">Yeni daire ilanı</Link>
      </div>

      {error && <div className="listing-error" role="alert">{error}</div>}
      {actionError && <div className="listing-error" role="alert">{actionError}</div>}

      <div className="my-listings-grid">
        {listings.map((listing) => {
          const actionLoading = loadingActionId === listing.id
          const canPublish = listing.status === 'draft' || listing.status === 'inactive'
          const canUnpublish = listing.status === 'published'
          const rent = listing.type === 'apartment_rent'
          return (
            <article className="my-listing-card" key={listing.id}>
              <div className="my-listing-media">
                {listing.imageUrl
                  ? <img src={listing.imageUrl} alt={listing.title ?? 'Daire ilanı'} />
                  : <span aria-hidden="true">D</span>}
              </div>
              <div className="my-listing-body">
                <div className="my-listing-topline">
                  <span className={`listing-status listing-status-${listing.status}`}>
                    {statusLabels[listing.status]}
                  </span>
                  <span>{rent ? 'Kiralık' : 'Satılık'}</span>
                </div>
                <h2>{listing.title ?? 'Daire taslağı'}</h2>
                <p className="my-listing-location">
                  {[listing.roomCount === 'studio' ? 'Stüdyo' : listing.roomCount, listing.grossM2 ? `${listing.grossM2} m²` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="my-listing-location">
                  {[listing.location.provinceName, listing.location.districtName]
                    .filter(Boolean)
                    .join(' · ') || 'Konum eklenmedi'}
                </p>
                <div className="my-listing-facts">
                  <strong>
                    {listing.priceAmount === null
                      ? 'Fiyat yok'
                      : new Intl.NumberFormat('tr-TR').format(listing.priceAmount) + (rent ? ' TL/ay' : ' TL')}
                  </strong>
                  <span>{new Date(listing.updatedAt).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="my-listing-actions">
                  {(listing.status === 'draft'
                    || listing.status === 'published'
                    || listing.status === 'inactive') && (
                    <Link className="my-listing-secondary" href={`/ilan-ver/daire?draft=${listing.id}`}>
                      Düzenle
                    </Link>
                  )}
                  {canPublish && (
                    <button type="button" disabled={actionLoading} onClick={() => void publish(listing.id)}>
                      {actionLoading ? 'Yayınlanıyor…' : 'Yayınla'}
                    </button>
                  )}
                  {canUnpublish && (
                    <>
                      <Link className="my-listing-secondary" href={`/daire/${listing.id}`}>İlanı gör</Link>
                      <button
                        className="my-listing-secondary"
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void unpublish(listing.id)}
                      >
                        Yayından kaldır
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
