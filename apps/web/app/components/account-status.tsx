'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiClientError, getMe, type MeSummary } from '../../lib/api-client'

const statusLabels = {
  active: 'Aktif',
  suspended: 'Askıya alındı',
  banned: 'Kalıcı olarak kapatıldı',
} as const

const actionLabels = {
  warning: 'Uyarı',
  suspend: 'Askıya alma',
  ban: 'Ban',
  reactivate: 'Aktifleştirme',
  listing_takedown: 'İlan kapatma',
  role_change: 'Rol değişikliği',
} as const

function dateLabel(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AccountStatusView() {
  const [me, setMe] = useState<MeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMe()
      .then((response) => {
        if (!cancelled) setMe(response)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          setUnauthorized(true)
          return
        }
        setError(loadError instanceof ApiClientError
          ? loadError.message
          : 'Hesap bilgileri yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="public-list-state">Hesap bilgileri yükleniyor…</div>
  }

  if (unauthorized) {
    return (
      <div className="public-list-state">
        <strong>Hesabını görmek için giriş yap.</strong>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (error || !me) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>Hesap bilgileri yüklenemedi.</strong>
        <span>{error ?? 'Bilinmeyen hata.'}</span>
      </div>
    )
  }

  return (
    <div className="account-status-view">
      <section className={`account-status-card account-status-${me.profile.accountStatus}`}>
        <div>
          <p className="listing-create-eyebrow">Hesap durumu</p>
          <h2>{statusLabels[me.profile.accountStatus]}</h2>
          <p>{me.user.name} · {me.user.email}</p>
        </div>
        {me.profile.suspendedUntil && (
          <span>Askı bitişi: {dateLabel(me.profile.suspendedUntil)}</span>
        )}
      </section>

      {me.profile.accountStatus !== 'active' && (
        <div className="account-warning-banner">
          Hesabın şu anda kısıtlı. İlan oluşturma, yayınlama ve mesaj gönderme gibi işlemler engellenir.
        </div>
      )}

      <h3 className="staff-section-title">Uyarılar ve işlemler</h3>
      <div className="staff-history">
        {me.enforcements.length === 0 && <p>Hesabında bir işlem kaydı yok.</p>}
        {me.enforcements.map((enforcement) => (
          <article key={enforcement.id}>
            <div>
              <strong>{actionLabels[enforcement.action]}</strong>
              <span>{dateLabel(enforcement.createdAt)}</span>
            </div>
            <p>{enforcement.reason}</p>
            {enforcement.listingTitle && <small>İlan: {enforcement.listingTitle}</small>}
            {enforcement.endsAt && <small>Bitiş: {dateLabel(enforcement.endsAt)}</small>}
          </article>
        ))}
      </div>

      <div className="account-status-actions">
        <Link className="my-listing-secondary" href="/ilanlarim">İlanlarıma dön</Link>
      </div>
    </div>
  )
}
