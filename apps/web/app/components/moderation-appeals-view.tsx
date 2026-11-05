import type { ModerationAppeal } from '../../lib/api-client'

function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' TL'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

interface ModerationAppealsViewProps {
  appeals: ModerationAppeal[]
  notes: Record<string, string>
  loadingActionId: string | null
  actionError: string | null
  onNoteChange: (appealId: string, note: string) => void
  onResolve: (appealId: string, action: 'approve' | 'reject') => void
}

export function ModerationAppealsView({
  appeals,
  notes,
  loadingActionId,
  actionError,
  onNoteChange,
  onResolve,
}: ModerationAppealsViewProps) {
  if (appeals.length === 0) {
    return (
      <div className="public-list-state my-listings-empty">
        <strong>Bekleyen itiraz yok.</strong>
        <span>Yeni bir itiraz geldiğinde burada görünecek.</span>
      </div>
    )
  }

  return (
    <div className="moderation-reports">
      {actionError && (
        <div className="listing-error" role="alert">{actionError}</div>
      )}
      <div className="moderation-report-list">
        {appeals.map((appeal) => {
          const actionLoading = loadingActionId === appeal.id
          const title = appeal.listing.title ?? 'Başlıksız ilan'
          return (
            <article className="moderation-report-card" key={appeal.id}>
              <div className="moderation-report-media">
                {appeal.listing.imageUrl
                  ? <img src={appeal.listing.imageUrl} alt={title} />
                  : <span aria-hidden="true">!</span>}
              </div>
              <div className="moderation-report-body">
                <div className="my-listing-topline">
                  <span className="listing-status listing-status-pending_review">İtiraz</span>
                  <span>{formatDate(appeal.createdAt)}</span>
                </div>
                <h2>{title}</h2>
                <p className="my-listing-location">
                  {[appeal.listing.provinceName, appeal.listing.districtName]
                    .filter((value): value is string => Boolean(value))
                    .join(' · ') || 'Konum yok'}
                </p>
                <div className="my-listing-facts">
                  <strong>
                    {appeal.listing.priceAmount === null
                      ? 'Fiyat yok'
                      : formatTry(appeal.listing.priceAmount)}
                  </strong>
                  <span>İlan durumu: {appeal.listing.status === 'rejected' ? 'Reddedildi' : appeal.listing.status}</span>
                </div>
                <p className="moderation-report-note">
                  <strong>Sahip itirazı:</strong> {appeal.note}
                </p>
                <label className="moderation-note-field">
                  <span>Karar notu (isteğe bağlı)</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={notes[appeal.id] ?? ''}
                    onChange={(event) => onNoteChange(appeal.id, event.target.value)}
                    placeholder="Kararın gerekçesini kısa bir not olarak bırakabilirsin."
                  />
                </label>
                <div className="my-listing-actions">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onResolve(appeal.id, 'approve')}
                  >
                    {actionLoading ? 'İşleniyor…' : 'İtirazı kabul et'}
                  </button>
                  <button
                    className="my-listing-secondary"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => onResolve(appeal.id, 'reject')}
                  >
                    İtirazı reddet
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
