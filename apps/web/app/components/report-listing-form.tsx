'use client'

import { type FormEvent, useState } from 'react'
import {
  ApiClientError,
  reportListing,
  type ReportReason,
} from '../../lib/api-client'

export const reportReasonOptions: Array<{ value: ReportReason; label: string }> = [
  { value: 'fraud', label: 'Dolandırıcılık veya şüpheli işlem' },
  { value: 'wrong_category', label: 'Yanlış kategori' },
  { value: 'prohibited', label: 'Yasaklı veya uygunsuz içerik' },
  { value: 'duplicate', label: 'Tekrarlanan ilan' },
  { value: 'misleading', label: 'Yanıltıcı bilgi veya fotoğraf' },
  { value: 'other', label: 'Diğer' },
]

interface ReportListingFormProps {
  listingId: string
  defaultOpen?: boolean
}

export function ReportListingForm({ listingId, defaultOpen = false }: ReportListingFormProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    if (!reason) {
      setError('Bir rapor nedeni seç.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      await reportListing(listingId, {
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setSubmitted(true)
      setNote('')
    } catch (submitError) {
      setError(submitError instanceof ApiClientError
        ? submitError.message
        : 'Rapor gönderilemedi. Tekrar deneyebilirsin.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="listing-report" aria-live="polite">
        <strong>Raporun alındı.</strong>
        <p>Moderasyon ekibi ilanı inceleyecek. İlgin için teşekkürler.</p>
      </section>
    )
  }

  return (
    <section className="listing-report">
      <button
        className="listing-report-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        İlanı raporla
      </button>

      {open && (
        <form className="listing-report-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            <span>Rapor nedeni</span>
            <select
              required
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason | '')}
            >
              <option value="" disabled>Rapor nedenini seç</option>
              {reportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Ek bilgi (isteğe bağlı)</span>
            <textarea
              maxLength={1000}
              rows={3}
              value={note}
              placeholder="İlanla ilgili kısa bir açıklama ekleyebilirsin."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error && <p className="field-error" role="alert">{error}</p>}

          <button className="listing-report-submit" type="submit" disabled={submitting}>
            {submitting ? 'Gönderiliyor…' : 'Raporu gönder'}
          </button>
        </form>
      )}
    </section>
  )
}
