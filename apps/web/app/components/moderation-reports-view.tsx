import Link from 'next/link'
import type {
  ModerationReport,
  ReportReason,
} from '../../lib/api-client'

export const reportReasonLabels: Record<ReportReason, string> = {
  fraud: 'Dolandırıcılık veya şüpheli işlem',
  wrong_category: 'Yanlış kategori',
  prohibited: 'Yasaklı veya uygunsuz içerik',
  duplicate: 'Tekrarlanan ilan',
  misleading: 'Yanıltıcı bilgi veya fotoğraf',
  other: 'Diğer',
}

const listingStatusLabels: Record<string, string> = {
  draft: 'Taslak',
  pending_verification: 'Doğrulanıyor',
  pending_review: 'İnceleme bekliyor',
  published: 'Yayında',
  rejected: 'Reddedildi',
  inactive: 'Yayından kaldırıldı',
}

function listingStatusLabel(status: string): string {
  return listingStatusLabels[status] ?? status
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

function locationLabel(report: ModerationReport): string {
  return [report.listing.provinceName, report.listing.districtName]
    .filter((value): value is string => Boolean(value))
    .join(' · ') || 'Konum yok'
}

interface ModerationReportsViewProps {
  reports: ModerationReport[]
  notes: Record<string, string>
  loadingActionId: string | null
  actionError: string | null
  onNoteChange: (reportId: string, note: string) => void
  onResolve: (reportId: string, action: 'reject' | 'dismiss') => void
}

export function ModerationReportsView({
  reports,
  notes,
  loadingActionId,
  actionError,
  onNoteChange,
  onResolve,
}: ModerationReportsViewProps) {
  if (reports.length === 0) {
    return (
      <div className="public-list-state my-listings-empty">
        <strong>Bekleyen rapor yok.</strong>
        <span>Yeni bir rapor geldiğinde burada görünecek.</span>
      </div>
    )
  }

  return (
    <div className="moderation-reports">
      {actionError && (
        <div className="listing-error" role="alert">{actionError}</div>
      )}

      <div className="moderation-report-list">
        {reports.map((report) => {
          const actionLoading = loadingActionId === report.id
          const title = report.listing.title ?? 'Başlıksız ilan'

          return (
            <article className="moderation-report-card" key={report.id}>
              <div className="moderation-report-media">
                {report.listing.imageUrl ? (
                  <img src={report.listing.imageUrl} alt={title} />
                ) : (
                  <span aria-hidden="true">!</span>
                )}
              </div>

              <div className="moderation-report-body">
                <div className="my-listing-topline">
                  <span className="listing-status listing-status-pending_review">
                    {reportReasonLabels[report.reason]}
                  </span>
                  <span>{formatDate(report.createdAt)}</span>
                </div>

                <h2>{title}</h2>
                <p className="my-listing-location">
                  {locationLabel(report)} · {report.reporterType === 'member' ? 'Üye' : 'Ziyaretçi'} bildirimi
                </p>

                <div className="my-listing-facts">
                  <strong>
                    {report.listing.priceAmount === null
                      ? 'Fiyat yok'
                      : formatTry(report.listing.priceAmount)}
                  </strong>
                  <span>İlan durumu: {listingStatusLabel(report.listing.status)}</span>
                </div>

                {report.note && (
                  <p className="moderation-report-note">
                    <strong>Rapor notu:</strong> {report.note}
                  </p>
                )}

                <label className="moderation-note-field">
                  <span>Moderasyon notu (isteğe bağlı)</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={notes[report.id] ?? ''}
                    onChange={(event) => onNoteChange(report.id, event.target.value)}
                    placeholder="Kararın gerekçesini kısa bir not olarak bırakabilirsin."
                  />
                </label>

                <div className="my-listing-actions">
                  {report.listing.status === 'published' && (
                    <Link className="my-listing-secondary" href={`/otomobil/${report.listingId}`}>
                      İlanı gör
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onResolve(report.id, 'reject')}
                  >
                    {actionLoading ? 'İşleniyor…' : 'İlanı reddet'}
                  </button>
                  <button
                    className="my-listing-secondary"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onResolve(report.id, 'dismiss')}
                  >
                    Raporu reddet
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
