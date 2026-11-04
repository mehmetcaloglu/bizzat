'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  getPublicCarListing,
  getPublicCarListingContact,
  type PublicCarListingDetail as PublicCarListingDetailData,
} from '../../lib/api-client'
import { PublicCarListingDetailView } from './public-car-listing-detail-view'

interface PublicCarListingDetailProps {
  listingId: string
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'İlan şu anda yüklenemiyor.'
}

export function PublicCarListingDetail({ listingId }: PublicCarListingDetailProps) {
  const [listing, setListing] = useState<PublicCarListingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [phone, setPhone] = useState<string | null>(null)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    setPhone(null)
    setPhoneError(null)

    void getPublicCarListing(listingId)
      .then((response) => {
        if (!cancelled) setListing(response.listing)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (loadError instanceof ApiClientError && loadError.status === 404) {
          setNotFound(true)
          return
        }
        setError(errorMessage(loadError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [listingId, retryVersion])

  async function showPhone() {
    if (!listing || phoneLoading) return
    setPhoneLoading(true)
    setPhoneError(null)
    try {
      const response = await getPublicCarListingContact(listing.id)
      setPhone(response.phoneE164)
    } catch (loadError) {
      setPhoneError(errorMessage(loadError))
    } finally {
      setPhoneLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="listing-detail-skeleton" aria-label="İlan yükleniyor">
        <span />
        <span />
        <span />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="public-list-state">
        <strong>İlan bulunamadı.</strong>
        <span>İlan yayından kaldırılmış veya bağlantı hatalı olabilir.</span>
        <Link href="/otomobil">Otomobil ilanlarına dön</Link>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>İlan yüklenemedi.</strong>
        <span>{error ?? 'İlan şu anda yüklenemiyor.'}</span>
        <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
          Tekrar dene
        </button>
      </div>
    )
  }

  return (
    <PublicCarListingDetailView
      listing={listing}
      phone={phone}
      phoneLoading={phoneLoading}
      phoneError={phoneError}
      onShowPhone={() => void showPhone()}
    />
  )
}
