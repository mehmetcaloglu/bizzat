'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  listMyCarListings,
  publishCarSaleListing,
  unpublishCarSaleListing,
  type OwnerCarListingSummary,
} from '../../lib/api-client'
import { MyListingsView } from './my-listings-view'

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'İlanların şu anda yüklenemiyor.'
}

export function MyListings() {
  const [listings, setListings] = useState<OwnerCarListingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setUnauthorized(false)

    void listMyCarListings()
      .then((response) => {
        if (!cancelled) setListings(response.items)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          setUnauthorized(true)
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
  }, [retryVersion])

  async function handlePublish(listingId: string) {
    setLoadingActionId(listingId)
    setActionError(null)
    try {
      const response = await publishCarSaleListing(listingId)
      setListings((current) => current.map((listing) => (
        listing.id === listingId
          ? {
              ...listing,
              status: response.listing.status,
              publishedAt: response.listing.publishedAt,
            }
          : listing
      )))
    } catch (publishError) {
      setActionError(errorMessage(publishError))
    } finally {
      setLoadingActionId(null)
    }
  }

  async function handleUnpublish(listingId: string) {
    setLoadingActionId(listingId)
    setActionError(null)
    try {
      const response = await unpublishCarSaleListing(listingId)
      setListings((current) => current.map((listing) => (
        listing.id === listingId
          ? { ...listing, status: response.listing.status }
          : listing
      )))
    } catch (unpublishError) {
      setActionError(errorMessage(unpublishError))
    } finally {
      setLoadingActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="my-listings-grid" aria-label="İlanların yükleniyor">
        {[0, 1].map((index) => (
          <div className="my-listing-card my-listing-skeleton" key={index} aria-hidden="true">
            <div className="my-listing-media" />
            <div className="my-listing-body">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="public-list-state">
        <strong>İlanlarını görmek için giriş yap.</strong>
        <span>Hesabına giriş yaptıktan sonra taslaklarını ve yayındaki ilanlarını yönetebilirsin.</span>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>İlanların yüklenemedi.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
          Tekrar dene
        </button>
      </div>
    )
  }

  return (
    <MyListingsView
      listings={listings}
      loadingActionId={loadingActionId}
      actionError={actionError}
      onPublish={(listingId) => void handlePublish(listingId)}
      onUnpublish={(listingId) => void handleUnpublish(listingId)}
    />
  )
}
