'use client'

import { useEffect, useState } from 'react'
import {
  ApiClientError,
  listPublicCarListings,
  type PublicCarListingItem,
} from '../../lib/api-client'

interface PublicCarListingsProps {
  limit?: number
}

const fuelLabels: Record<PublicCarListingItem['attributes']['fuelType'], string> = {
  benzin: 'Benzin',
  dizel: 'Dizel',
  lpg: 'LPG',
  hibrit: 'Hibrit',
  elektrik: 'Elektrik',
}

const transmissionLabels: Record<PublicCarListingItem['attributes']['transmission'], string> = {
  manuel: 'Manuel',
  otomatik: 'Otomatik',
  yari_otomatik: 'Yarı otomatik',
}

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' TL'
}

function formatKm(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' km'
}

export function PublicCarListings({ limit = 12 }: PublicCarListingsProps) {
  const [items, setItems] = useState<PublicCarListingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void listPublicCarListings(limit)
      .then((nextItems) => {
        if (!cancelled) setItems(nextItems)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof ApiClientError
          ? loadError.message
          : 'İlanlar şu anda yüklenemiyor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [limit])

  if (loading) {
    return (
      <div className="public-listing-grid" aria-label="İlanlar yükleniyor">
        {Array.from({ length: Math.min(limit, 6) }, (_, index) => (
          <div className="listing-card listing-card-skeleton" key={index} aria-hidden="true">
            <div className="listing-card-media" />
            <div className="listing-card-body">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="public-list-state public-list-error" role="alert">{error}</div>
  }

  if (items.length === 0) {
    return (
      <div className="public-list-state">
        <strong>Henüz yayında ilan yok.</strong>
        <span>Geliştirme ilanlarını seed ettikten sonra burada görebilirsin.</span>
      </div>
    )
  }

  return (
    <div className="public-listing-grid">
      {items.map((item) => (
        <article className="listing-card" key={item.id}>
          {item.imageUrl ? (
            <div
              className="listing-card-media"
              role="img"
              aria-label={item.title}
              style={{ backgroundImage: `url("${item.imageUrl}")` }}
            />
          ) : (
            <div className="listing-card-media listing-card-placeholder" aria-hidden="true">
              <span>{item.vehicle.brandName.slice(0, 1)}</span>
            </div>
          )}
          <div className="listing-card-body">
            <div className="listing-card-location">
              {item.location.provinceName} · {item.location.districtName}
            </div>
            <h3>{item.title}</h3>
            <strong className="listing-card-price">{formatTry(item.priceAmount)}</strong>
            <div className="listing-card-specs">
              <span>{item.modelYear}</span>
              <span>{formatKm(item.mileageKm)}</span>
              <span>{fuelLabels[item.attributes.fuelType]}</span>
              <span>{transmissionLabels[item.attributes.transmission]}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
