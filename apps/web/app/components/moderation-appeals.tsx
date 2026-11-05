'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  listModerationAppeals,
  resolveModerationAppeal,
  type ModerationAppeal,
} from '../../lib/api-client'
import { ModerationAppealsView } from './moderation-appeals-view'

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'İtirazlar şu anda yüklenemiyor.'
}

export function ModerationAppeals() {
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setUnauthorized(false)
    setForbidden(false)

    void listModerationAppeals('pending')
      .then((response) => {
        if (!cancelled) setAppeals(response.items)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        if (loadError instanceof ApiClientError && loadError.status === 401) {
          setUnauthorized(true)
          return
        }
        if (loadError instanceof ApiClientError && loadError.status === 403) {
          setForbidden(true)
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

  async function handleResolve(appealId: string, action: 'approve' | 'reject') {
    setLoadingActionId(appealId)
    setActionError(null)
    const note = notes[appealId]?.trim()
    try {
      await resolveModerationAppeal(appealId, {
        action,
        ...(note ? { note } : {}),
      })
      setAppeals((current) => current.filter((item) => item.id !== appealId))
      setNotes((current) => {
        const next = { ...current }
        delete next[appealId]
        return next
      })
    } catch (resolveError) {
      setActionError(errorMessage(resolveError))
    } finally {
      setLoadingActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="moderation-report-list" aria-label="İtirazlar yükleniyor">
        {[0, 1].map((index) => (
          <div className="moderation-report-card my-listing-skeleton" key={index} aria-hidden="true">
            <div className="moderation-report-media" />
            <div className="moderation-report-body">
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
        <strong>İtirazları görmek için giriş yap.</strong>
        <span>Yetkili hesapla giriş yaptıktan sonra itiraz kuyruğunu görebilirsin.</span>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="public-list-state">
        <strong>Bu alana erişimin yok.</strong>
        <span>İtirazları yalnız moderatör ve yöneticiler görebilir.</span>
        <Link href="/">Ana sayfaya dön</Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>İtirazlar yüklenemedi.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
          Tekrar dene
        </button>
      </div>
    )
  }

  return (
    <ModerationAppealsView
      appeals={appeals}
      notes={notes}
      loadingActionId={loadingActionId}
      actionError={actionError}
      onNoteChange={(appealId, note) => setNotes((current) => ({
        ...current,
        [appealId]: note,
      }))}
      onResolve={(appealId, action) => void handleResolve(appealId, action)}
    />
  )
}
