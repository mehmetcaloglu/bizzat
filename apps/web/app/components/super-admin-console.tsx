'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  changeAdminUserRole,
  getAdminSummary,
  listAdminEnforcements,
  searchStaffUsers,
  type AdminEnforcementItem,
  type AdminSummary,
  type StaffUserSummary,
} from '../../lib/api-client'

const actionLabels: Record<AdminEnforcementItem['action'], string> = {
  warning: 'Uyarı',
  suspend: 'Askıya alma',
  ban: 'Ban',
  reactivate: 'Aktifleştirme',
  listing_takedown: 'İlan kapatma',
  role_change: 'Rol değişikliği',
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'İşlem tamamlanamadı.'
}

export function SuperAdminConsole() {
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [enforcements, setEnforcements] = useState<AdminEnforcementItem[]>([])
  const [users, setUsers] = useState<StaffUserSummary[]>([])
  const [query, setQuery] = useState('')
  const [roles, setRoles] = useState<Record<string, 'user' | 'moderator' | 'admin'>>({})
  const [loading, setLoading] = useState(true)
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  async function load(search = '') {
    setLoading(true)
    setError(null)
    setUnauthorized(false)
    setForbidden(false)
    try {
      const [summaryResponse, enforcementResponse, userResponse] = await Promise.all([
        getAdminSummary(),
        listAdminEnforcements(),
        searchStaffUsers(search),
      ])
      setSummary(summaryResponse)
      setEnforcements(enforcementResponse.items)
      setUsers(userResponse.items)
      setRoles(Object.fromEntries(userResponse.items.map((user) => [user.id, user.role])))
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
    void load()
  }, [])

  async function saveRole(user: StaffUserSummary) {
    const role = roles[user.id]
    if (!role || role === user.role) return
    setSavingRoleId(user.id)
    setActionError(null)
    setActionMessage(null)
    try {
      const response = await changeAdminUserRole(user.id, role)
      const enforcementResponse = await listAdminEnforcements()
      setUsers((current) => current.map((item) => (
        item.id === user.id ? response.user : item
      )))
      setRoles((current) => ({ ...current, [user.id]: response.user.role }))
      setEnforcements(enforcementResponse.items)
      setActionMessage(`${user.name} için rol ${role} olarak güncellendi.`)
    } catch (saveError) {
      setActionError(errorMessage(saveError))
    } finally {
      setSavingRoleId(null)
    }
  }

  if (unauthorized) {
    return (
      <div className="public-list-state">
        <strong>Yönetim paneline giriş yap.</strong>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="public-list-state">
        <strong>Bu alan yalnız admin kullanıcılar içindir.</strong>
        <Link href="/">Ana sayfaya dön</Link>
      </div>
    )
  }

  if (loading) {
    return <div className="public-list-state">Yönetim paneli yükleniyor…</div>
  }

  if (error || !summary) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>Yönetim paneli yüklenemedi.</strong>
        <span>{error ?? 'Bilinmeyen hata.'}</span>
        <button type="button" onClick={() => void load(query)}>Tekrar dene</button>
      </div>
    )
  }

  return (
    <div className="super-admin">
      <section className="admin-summary-grid">
        <div><span>Toplam kullanıcı</span><strong>{summary.users.total}</strong></div>
        <div><span>Aktif</span><strong>{summary.users.active}</strong></div>
        <div className="is-warning"><span>Askıda</span><strong>{summary.users.suspended}</strong></div>
        <div className="is-danger"><span>Banlı</span><strong>{summary.users.banned}</strong></div>
        <div><span>Yayında ilan</span><strong>{summary.listings.published}</strong></div>
        <div><span>Açık rapor</span><strong>{summary.moderation.openReports}</strong></div>
        <div className={summary.moderation.overdueReports > 0 ? 'is-danger' : undefined}>
          <span>Geciken rapor</span><strong>{summary.moderation.overdueReports}</strong>
        </div>
        <div><span>Bekleyen itiraz</span><strong>{summary.moderation.pendingAppeals}</strong></div>
      </section>

      <div className="admin-links">
        <Link className="market-cta" href="/destek">Destek paneline git</Link>
        <Link className="market-cta market-cta-secondary" href="/moderasyon/raporlar">Moderasyon kuyruğu</Link>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Kullanıcı rolleri</h2>
          <form
            className="staff-search-form"
            onSubmit={(event) => {
              event.preventDefault()
              void load(query)
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
            <button type="submit">Ara</button>
          </form>
        </div>
        {actionError && <div className="listing-error" role="alert">{actionError}</div>}
        {actionMessage && <div className="listing-success" role="status">{actionMessage}</div>}
        <div className="admin-role-list">
          {users.map((user) => (
            <article key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>
                  {user.accountStatus === 'active' ? 'Aktif' : user.accountStatus === 'suspended' ? 'Askıda' : 'Banlı'}
                  {' · '}
                  {user.listingCount} ilan
                </small>
              </div>
              <select
                value={roles[user.id] ?? user.role}
                onChange={(event) => setRoles((current) => ({
                  ...current,
                  [user.id]: event.target.value as 'user' | 'moderator' | 'admin',
                }))}
              >
                <option value="user">Kullanıcı</option>
                <option value="moderator">Moderatör</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="button"
                disabled={savingRoleId === user.id || (roles[user.id] ?? user.role) === user.role}
                onClick={() => void saveRole(user)}
              >
                {savingRoleId === user.id ? 'Kaydediliyor…' : 'Rolü kaydet'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <h2>Son yaptırım ve rol işlemleri</h2>
        <div className="staff-history">
          {enforcements.length === 0 && <p>Henüz işlem yok.</p>}
          {enforcements.map((enforcement) => (
            <article key={enforcement.id}>
              <div>
                <strong>{actionLabels[enforcement.action]}</strong>
                <span>{dateLabel(enforcement.createdAt)}</span>
              </div>
              <p>{enforcement.reason}</p>
              <small>
                {enforcement.targetName} · {enforcement.targetEmail}
                {enforcement.actorName ? ` · İşlemi yapan: ${enforcement.actorName}` : ''}
              </small>
              {enforcement.listingTitle && <small>İlan: {enforcement.listingTitle}</small>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
