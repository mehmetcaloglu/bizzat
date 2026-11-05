'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ApiClientError, createListingAppeal } from '../../lib/api-client'

export function ListingAppealForm({ listingId }: { listingId: string }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    const trimmed = note.trim()
    if (trimmed.length < 10) {
      setError('İtiraz notu en az 10 karakter olmalı.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await createListingAppeal(listingId, trimmed)
      setSubmitted(true)
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.status === 401) {
        setError('İtiraz göndermek için giriş yapman gerekiyor.')
        return
      }
      setError(submitError instanceof ApiClientError
        ? submitError.message
        : 'İtirazın gönderilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="public-list-state">
        <strong>İtirazın alındı.</strong>
        <span>Moderatör ekibi itirazını inceleyecek. Durumu ilanlarım sayfasından takip edebilirsin.</span>
        <Link href="/ilanlarim">İlanlarıma dön</Link>
      </div>
    )
  }

  return (
    <form
      className="appeal-form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label>
        <span>Neden yeniden incelenmesini istiyorsun?</span>
        <textarea
          rows={6}
          minLength={10}
          maxLength={1000}
          required
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Red kararının neden haksız olduğunu kısa ve açık şekilde anlat."
        />
      </label>
      {error && <div className="listing-error" role="alert">{error}</div>}
      <div className="appeal-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Gönderiliyor…' : 'İtirazı gönder'}
        </button>
        <Link className="my-listing-secondary" href="/ilanlarim">Vazgeç</Link>
      </div>
      <p>Her ilan için yalnızca bir itiraz gönderebilirsin.</p>
    </form>
  )
}
