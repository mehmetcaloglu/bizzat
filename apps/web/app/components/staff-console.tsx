'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  banStaffUser,
  getStaffUser,
  reactivateStaffUser,
  searchStaffUsers,
  suspendStaffUser,
  takedownStaffListing,
  warnStaffUser,
  type AccountEnforcement,
  type StaffListingSummary,
  type StaffUserDetailResponse,
  type StaffUserSummary,
} from '../../lib/api-client'

const statusLabels = {
  active: 'Aktif',
  suspended: 'Askıda',
  banned: 'Banlı',
} as const

const actionLabels: Record<AccountEnforcement['action'], string> = {
  warning: 'Uyarı',
  suspend: 'Askıya alma',
  ban: 'Ban',
  reactivate: 'Aktifleştirme',
  listing_takedown: 'İlan kapatma',
}

const listingStatusLabels: Record<string, string> = {
  draft: 'Taslak',
  pending_verification: 'Doğrulanıyor',
  pending_review: 'İnceleme bekliyor',
  published: 'Yayında',
  rejected: 'Reddedildi',
  inactive: 'Yayından kaldırıldı',
}

function dateLabel(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'İşlem tamamlanamadı.'
}

export function StaffConsole() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<StaffUserSummary[]>([])
  const [selected, setSelected] = useState<StaffUserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingUser, setLoadingUser] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [reason, setReason] = useState('')
  const [suspendDays, setSuspendDays] = useState('7')

  async function loadUsers(search = '') {
    setLoading(true)
    setError(null)
    setUnauthorized(false)
    setForbidden(false)
    try {
      const response = await searchStaffUsers(search)
      setUsers(response.items)
    } catch (loadError) {
      if (loadError instanceof ApiClientError && loadError.status === 401) {
        setUnauthorized(true)
      } else if (loadError instanceof ApiClientError && loadError.status === 403) {
        setForbidden(true)
      } else {
        setError(errorMessage(loadError))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  async function openUser(userId: string) {
    setLoadingUser(true)
    setError(null)
    setActionError(null)
    setActionMessage(null)
    try {
      setSelected(await getStaffUser(userId))
      setReason('')
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoadingUser(false)
    }
  }

  async function refreshSelected(): Promise<StaffUserDetailResponse | null> {
    if (!selected) return null
    const detail = await getStaffUser(selected.user.id)
    setSelected(detail)
    return detail
  }

  async function runAction(label: string, action: () => Promise<unknown>) {
    const trimmed = reason.trim()
    if (trimmed.length < 5) {
      setActionError('İşlem nedeni en az 5 karakter olmalı.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)
    try {
      await action()
      const detail = await refreshSelected()
      setReason('')
      setActionMessage(`${label} kaydedildi.`)
      setUsers((current) => current.map((user) => (
        detail && user.id === detail.user.id
          ? { ...user, accountStatus: detail.user.accountStatus, warningCount: detail.user.warningCount }
          : user
      )))
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure))
    } finally {
      setActionLoading(false)
    }
  }

  if (unauthorized) {
    return (
      <div className="public-list-state">
        <strong>Destek paneline giriş yap.</strong>
        <span>Yetkili hesapla giriş yaptıktan sonra kullanıcı işlemlerini yönetebilirsin.</span>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="public-list-state">
        <strong>Bu alana erişimin yok.</strong>
        <span>Destek panelini yalnız moderatör ve admin kullanabilir.</span>
        <Link href="/">Ana sayfaya dön</Link>
      </div>
    )
  }

  return (
    <div className="staff-console">
      <section className="staff-search-panel">
        <form
          className="staff-search-form"
          onSubmit={(event) => {
            event.preventDefault()
            void loadUsers(query)
          }}
        >
          <label>
            <span>Kullanıcı ara</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ad veya e-posta"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Aranıyor…' : 'Ara'}
          </button>
        </form>
        {error && <div className="listing-error" role="alert">{error}</div>}
        <div className="staff-user-list">
          {users.map((user) => (
            <button
              type="button"
              className={selected?.user.id === user.id ? 'is-selected' : undefined}
              key={user.id}
              onClick={() => void openUser(user.id)}
            >
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>
                {user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderatör' : 'Kullanıcı'}
                {' · '}
                {statusLabels[user.accountStatus]}
                {' · '}
                {user.warningCount} uyarı
              </small>
            </button>
          ))}
          {!loading && users.length === 0 && <p>Kullanıcı bulunamadı.</p>}
        </div>
      </section>

      <section className="staff-detail-panel">
        {loadingUser && <div className="public-list-state">Kullanıcı yükleniyor…</div>}
        {!selected && !loadingUser && (
          <div className="public-list-state">
            <strong>Bir kullanıcı seç.</strong>
            <span>Uyarı, askıya alma, ban ve ilan kapatma işlemleri burada yapılır.</span>
          </div>
        )}
        {selected && (
          <>
            <div className="staff-user-header">
              <div>
                <p className="listing-create-eyebrow">Kullanıcı</p>
                <h2>{selected.user.name}</h2>
                <p>{selected.user.email}</p>
              </div>
              <span className={`staff-status staff-status-${selected.user.accountStatus}`}>
                {statusLabels[selected.user.accountStatus]}
              </span>
            </div>

            <div className="staff-facts">
              <span>Rol: {selected.user.role}</span>
              <span>Uyarı: {selected.user.warningCount}</span>
              <span>İlan: {selected.user.listingCount}</span>
              <span>Askı bitişi: {dateLabel(selected.user.suspendedUntil)}</span>
            </div>

            <div className="staff-action-box">
              <label>
                <span>İşlem nedeni</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Uygulanan işlemin gerekçesini yaz."
                />
              </label>
              {actionError && <div className="listing-error" role="alert">{actionError}</div>}
              {actionMessage && <div className="listing-success" role="status">{actionMessage}</div>}
              <div className="staff-action-buttons">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction('Uyarı', () => warnStaffUser(selected.user.id, reason.trim()))}
                >
                  Uyarı ver
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction('Askıya alma', () => suspendStaffUser(
                    selected.user.id,
                    reason.trim(),
                    Number(suspendDays),
                  ))}
                >
                  Askıya al
                </button>
                <select value={suspendDays} onChange={(event) => setSuspendDays(event.target.value)}>
                  <option value="1">1 gün</option>
                  <option value="7">7 gün</option>
                  <option value="30">30 gün</option>
                  <option value="90">90 gün</option>
                </select>
                <button
                  className="staff-danger"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction('Ban', () => banStaffUser(selected.user.id, reason.trim()))}
                >
                  Banla
                </button>
                <button
                  className="my-listing-secondary"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction('Aktifleştirme', () => reactivateStaffUser(
                    selected.user.id,
                    reason.trim(),
                  ))}
                >
                  Aktifleştir
                </button>
              </div>
            </div>

            <h3 className="staff-section-title">İlanlar</h3>
            <div className="staff-listing-list">
              {selected.listings.length === 0 && <p>Bu kullanıcının ilanı yok.</p>}
              {selected.listings.map((listing: StaffListingSummary) => (
                <article key={listing.id}>
                  <div>
                    <strong>{listing.title ?? 'Başlıksız ilan'}</strong>
                    <span>
                      {listing.type === 'car_sale' ? 'Otomobil' : 'Daire'}
                      {' · '}
                      {listingStatusLabels[listing.status] ?? listing.status}
                      {' · '}
                      {listing.priceAmount === null
                        ? 'Fiyat yok'
                        : new Intl.NumberFormat('tr-TR').format(listing.priceAmount) + ' TL'}
                    </span>
                  </div>
                  {listing.status !== 'rejected' && (
                    <button
                      className="staff-danger"
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void runAction('İlan kapatma', () => takedownStaffListing(
                        listing.id,
                        reason.trim(),
                      ))}
                    >
                      İlanı kapat
                    </button>
                  )}
                </article>
              ))}
            </div>

            <h3 className="staff-section-title">İşlem geçmişi</h3>
            <div className="staff-history">
              {selected.enforcements.length === 0 && <p>Henüz işlem yok.</p>}
              {selected.enforcements.map((enforcement) => (
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
          </>
        )}
      </section>
    </div>
  )
}
