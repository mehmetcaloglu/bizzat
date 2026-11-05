'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  listModerationReports,
  resolveModerationReport,
  type ModerationReport,
  type ModerationReportListResponse,
} from '../../lib/api-client'
import { ModerationReportsView } from './moderation-reports-view'

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'Raporlar şu anda yüklenemiyor.'
}

const emptySummary: ModerationReportListResponse['summary'] = {
  slaHours: 24,
  openCount: 0,
  overdueCount: 0,
  dueSoonCount: 0,
  oldestOpenCreatedAt: null,
}

export function ModerationReports() {
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [summary, setSummary] = useState<ModerationReportListResponse['summary']>(emptySummary)
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

    void listModerationReports('open')
      .then((response) => {
        if (cancelled) return
        setReports(response.items)
        setSummary(response.summary)
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

  async function handleResolve(reportId: string, action: 'reject' | 'dismiss') {
    setLoadingActionId(reportId)
    setActionError(null)
    const note = notes[reportId]?.trim()
    try {
      await resolveModerationReport(reportId, {
        action,
        ...(note ? { note } : {}),
      })
      const report = reports.find((item) => item.id === reportId)
      const removed = reports.filter((item) => (
        action === 'reject'
          ? item.listingId === report?.listingId
          : item.id === reportId
      ))
      setReports((current) => current.filter((item) => (
        action === 'reject'
          ? item.listingId !== report?.listingId
          : item.id !== reportId
      )))
      setSummary((current) => {
        const openCount = Math.max(0, current.openCount - removed.length)
        return {
          ...current,
          openCount,
          overdueCount: Math.max(
            0,
            current.overdueCount - removed.filter((item) => item.slaState === 'overdue').length,
          ),
          dueSoonCount: Math.max(
            0,
            current.dueSoonCount - removed.filter((item) => item.slaState === 'due_soon').length,
          ),
          oldestOpenCreatedAt: openCount === 0 ? null : current.oldestOpenCreatedAt,
        }
      })
      setNotes((current) => {
        const next = { ...current }
        delete next[reportId]
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
      <div className="moderation-report-list" aria-label="Raporlar yükleniyor">
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
        <strong>Moderasyon için giriş yap.</strong>
        <span>Yetkili hesapla giriş yaptıktan sonra rapor kuyruğunu görebilirsin.</span>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="public-list-state">
        <strong>Bu alana erişimin yok.</strong>
        <span>Moderasyon raporlarını yalnız moderatör ve yöneticiler görebilir.</span>
        <Link href="/">Ana sayfaya dön</Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>Raporlar yüklenemedi.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
          Tekrar dene
        </button>
      </div>
    )
  }

  return (
    <ModerationReportsView
      reports={reports}
      summary={summary}
      notes={notes}
      loadingActionId={loadingActionId}
      actionError={actionError}
      onNoteChange={(reportId, note) => setNotes((current) => ({
        ...current,
        [reportId]: note,
      }))}
      onResolve={(reportId, action) => void handleResolve(reportId, action)}
    />
  )
}
