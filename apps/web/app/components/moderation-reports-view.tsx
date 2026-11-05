import Link from 'next/link'
import type {
  ModerationReport,
  ModerationReportListResponse,
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

function slaLabel(report: ModerationReport): string | null {
  if (report.slaState === 'overdue') return 'SLA gecikti'
  if (report.slaState === 'due_soon') return 'SLA yaklaşıyor'
  return null
}

function ModerationSlaSummary({
  summary,
}: {
  summary: ModerationReportListResponse['summary']
}) {
  return (
    <section className="moderation-sla-summary" aria-label="Moderasyon SLA özeti">
      <div>
        <span>Açık rapor</span>
        <strong>{summary.openCount}</strong>
      </div>
      <div className={summary.overdueCount > 0 ? 'is-overdue' : undefined}>
        <span>Geciken</span>
        <strong>{summary.overdueCount}</strong>
      </div>
      <div className={summary.dueSoonCount > 0 ? 'is-due-soon' : undefined}>
        <span>4 saat içinde</span>
        <strong>{summary.dueSoonCount}</strong>
      </div>
      <div>
        <span>Yanıt hedefi</span>
        <strong>{summary.slaHours} saat</strong>
      </div>
    </section>
  )
}

interface ModerationReportsViewProps {
  reports: ModerationReport[]
  summary: ModerationReportListResponse['summary']
  notes: Record<string, string>
  loadingActionId: string | null
  actionError: string | null
  onNoteChange: (reportId: string, note: string) => void
  onResolve: (reportId: string, action: 'reject' | 'dismiss') => void
}

export function ModerationReportsView({
  reports,
  summary,
  notes,
  loadingActionId,
  actionError,
  onNoteChange,
  onResolve,
}: ModerationReportsViewProps) {
  if (reports.length === 0) {
    return (
      <div className="moderation-reports">
        <ModerationSlaSummary summary={summary} />
        <div className="public-list-state my-listings-empty">
          <strong>Bekleyen rapor yok.</strong>
          <span>Yeni bir rapor geldiğinde burada görünecek.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="moderation-reports">
      <ModerationSlaSummary summary={summary} />
      {actionError && (
        <div className="listing-error" role="alert">{actionError}</div>
      )}

      <div className="moderation-report-list">
        {reports.map((report) => {
          const actionLoading = loadingActionId === report.id
          const title = report.listing.title ?? 'Başlıksız ilan'
          const sla = slaLabel(report)
          const listingHref = report.listing.type === 'car_sale'
            ? `/otomobil/${report.listingId}`
            : `/daire/${report.listingId}`

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
                  {sla && (
                    <span
                      className={`moderation-sla-badge ${
                        report.slaState === 'overdue' ? 'is-overdue' : 'is-due-soon'
                      }`}
                      title={report.slaDueAt ? `Hedef: ${formatDate(report.slaDueAt)}` : undefined}
                    >
                      {sla}
                    </span>
                  )}
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
                    <Link className="my-listing-secondary" href={listingHref}>
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
