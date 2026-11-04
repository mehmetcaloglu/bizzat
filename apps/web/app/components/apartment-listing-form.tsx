'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  createApartmentDraft,
  getMe,
  getOwnedApartmentListing,
  listDistricts,
  listNeighborhoods,
  listProvinces,
  makeApartmentDraftImageCover,
  publishApartmentListing,
  removeApartmentDraftImage,
  updateApartmentDraftDetails,
  uploadApartmentDraftImage,
  type ApartmentDeedStatus,
  type ApartmentDraftResponse,
  type ApartmentHeating,
  type ApartmentKitchen,
  type ApartmentOccupancy,
  type ApartmentParking,
  type ApartmentRoomCount,
  type ApartmentTransactionType,
  type LocationReferenceItem,
  type NeighborhoodReferenceItem,
  type UpdateApartmentDraftDetailsInput,
} from '../../lib/api-client'

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'error'

const editableStatusLabels = {
  draft: 'Taslak',
  published: 'Yayında',
  inactive: 'Yayından kaldırıldı',
} as const

interface ApartmentFormValues {
  title: string
  description: string
  priceAmount: string
  provinceId: string
  districtId: string
  neighborhoodId: string
  contactPhoneE164: string
  showPhone: boolean
  roomCount: ApartmentRoomCount
  grossM2: string
  netM2: string
  buildingAge: string
  floor: string
  totalFloors: string
  heating: ApartmentHeating
  bathroomCount: string
  kitchen: ApartmentKitchen
  balcony: boolean
  elevator: boolean
  parking: ApartmentParking
  furnished: boolean
  occupancy: ApartmentOccupancy
  inSite: boolean
  deedStatus: ApartmentDeedStatus
  creditEligible: string
  swapAvailable: string
  depositAmount: string
}

const emptyForm: ApartmentFormValues = {
  title: '',
  description: '',
  priceAmount: '',
  provinceId: '',
  districtId: '',
  neighborhoodId: '',
  contactPhoneE164: '',
  showPhone: true,
  roomCount: '2+1',
  grossM2: '',
  netM2: '',
  buildingAge: '',
  floor: '',
  totalFloors: '',
  heating: 'combi',
  bathroomCount: '1',
  kitchen: 'closed',
  balcony: false,
  elevator: false,
  parking: 'none',
  furnished: false,
  occupancy: 'empty',
  inSite: false,
  deedStatus: 'condominium',
  creditEligible: 'false',
  swapAvailable: 'false',
  depositAmount: '',
}

type ApartmentBooleanField = 'balcony' | 'elevator' | 'furnished' | 'inSite'

const booleanFields: Array<[ApartmentBooleanField, string]> = [
  ['balcony', 'Balkon'],
  ['elevator', 'Asansör'],
  ['furnished', 'Eşyalı'],
  ['inSite', 'Site içinde'],
]

const roomCounts: ApartmentRoomCount[] = [
  'studio', '1+0', '1+1', '1.5+1', '2+0', '2+1', '2.5+1', '2+2',
  '3+0', '3+1', '3.5+1', '3+2', '4+0', '4+1', '4.5+1', '4+2',
  '5+1', '5+2', '6+1', '7+1', '8+1', '9+1', '10+',
]

const heatingLabels: Record<ApartmentHeating, string> = {
  none: 'Yok',
  stove: 'Soba',
  central: 'Merkezi',
  combi: 'Kombi',
  underfloor: 'Yerden ısıtma',
  air_conditioning: 'Klima',
  heat_pump: 'Isı pompası',
  solar: 'Güneş enerjisi',
  fireplace: 'Şömine',
}

const parkingLabels: Record<ApartmentParking, string> = {
  none: 'Yok',
  open: 'Açık otopark',
  closed: 'Kapalı otopark',
  both: 'Açık ve kapalı',
}

const occupancyLabels: Record<ApartmentOccupancy, string> = {
  empty: 'Boş',
  tenant: 'Kiracılı',
  owner: 'Mülk sahibi',
}

const deedLabels: Record<ApartmentDeedStatus, string> = {
  condominium: 'Kat mülkiyetli',
  easement: 'Kat irtifaklı',
  shared: 'Hisseli tapu',
  detached: 'Müstakil tapulu',
  land: 'Arsa tapulu',
  cooperative: 'Kooperatif hisseli tapu',
  usufruct: 'İntifa hakkı tesisli',
  foreign: 'Yurt dışı tapulu',
  unregistered: 'Tapu kaydı yok',
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formFromDraft(draft: ApartmentDraftResponse['listing']): ApartmentFormValues {
  const details = draft.details
  if (!details) return { ...emptyForm }
  return {
    title: draft.title ?? '',
    description: details.description,
    priceAmount: String(details.priceAmount),
    provinceId: details.location.province.id,
    districtId: details.location.district.id,
    neighborhoodId: details.location.neighborhood.id,
    contactPhoneE164: draft.contact?.phoneE164 ?? '',
    showPhone: draft.contact?.showPhone ?? true,
    roomCount: details.roomCount,
    grossM2: String(details.grossM2),
    netM2: details.netM2 === null ? '' : String(details.netM2),
    buildingAge: details.buildingAge === null ? '' : String(details.buildingAge),
    floor: details.floor === null ? '' : String(details.floor),
    totalFloors: details.totalFloors === null ? '' : String(details.totalFloors),
    heating: details.heating,
    bathroomCount: String(details.bathroomCount),
    kitchen: details.kitchen,
    balcony: details.balcony,
    elevator: details.elevator,
    parking: details.parking,
    furnished: details.furnished,
    occupancy: details.occupancy,
    inSite: details.inSite,
    deedStatus: details.deedStatus,
    creditEligible: details.creditEligible === null ? '' : String(details.creditEligible),
    swapAvailable: details.swapAvailable === null ? '' : String(details.swapAvailable),
    depositAmount: details.depositAmount === null ? '' : String(details.depositAmount),
  }
}

function inputFromForm(
  form: ApartmentFormValues,
  transactionType: ApartmentTransactionType,
): UpdateApartmentDraftDetailsInput {
  const title = form.title.trim()
  return {
    priceAmount: Number(form.priceAmount),
    provinceId: form.provinceId,
    districtId: form.districtId,
    neighborhoodId: form.neighborhoodId,
    description: form.description.trim(),
    ...(title ? { title } : {}),
    contactPhoneE164: form.contactPhoneE164,
    showPhone: form.showPhone,
    roomCount: form.roomCount,
    grossM2: Number(form.grossM2),
    netM2: optionalNumber(form.netM2),
    buildingAge: optionalNumber(form.buildingAge),
    floor: optionalNumber(form.floor),
    totalFloors: optionalNumber(form.totalFloors),
    heating: form.heating,
    bathroomCount: Number(form.bathroomCount),
    kitchen: form.kitchen,
    balcony: form.balcony,
    elevator: form.elevator,
    parking: form.parking,
    furnished: form.furnished,
    occupancy: form.occupancy,
    inSite: form.inSite,
    deedStatus: form.deedStatus,
    creditEligible: transactionType === 'sale' && form.creditEligible !== ''
      ? form.creditEligible === 'true'
      : null,
    swapAvailable: transactionType === 'sale' && form.swapAvailable !== ''
      ? form.swapAvailable === 'true'
      : null,
    depositAmount: transactionType === 'rent' ? optionalNumber(form.depositAmount) : null,
  }
}

function validationError(form: ApartmentFormValues, transactionType: ApartmentTransactionType): string | null {
  if (form.title.trim().length < 10) return 'Başlık en az 10 karakter olmalı.'
  if (form.description.trim().length < 20) return 'Açıklama en az 20 karakter olmalı.'
  if (Number(form.priceAmount) < 1) return 'Geçerli bir fiyat gir.'
  if (!form.provinceId || !form.districtId || !form.neighborhoodId) return 'Konum bilgilerini tamamla.'
  if (!/^\+90[0-9]{10}$/.test(form.contactPhoneE164)) return 'Telefonu +90 5xx xxx xx xx formatında gir.'
  if (Number(form.grossM2) < 1) return 'Brüt metrekareyi gir.'
  if (Number(form.bathroomCount) < 0) return 'Banyo sayısını gir.'
  if (transactionType === 'rent' && (optionalNumber(form.depositAmount) ?? 0) < 1) {
    return 'Kiralık ilan için depozito tutarını gir.'
  }
  return null
}

function message(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'İşlem tamamlanamadı. Tekrar deneyebilirsin.'
}

export function ApartmentListingForm() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [transactionType, setTransactionType] = useState<ApartmentTransactionType>('sale')
  const [draft, setDraft] = useState<ApartmentDraftResponse['listing'] | null>(null)
  const [form, setForm] = useState<ApartmentFormValues>({ ...emptyForm })
  const [provinces, setProvinces] = useState<LocationReferenceItem[]>([])
  const [districts, setDistricts] = useState<LocationReferenceItem[]>([])
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodReferenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await getMe()
        if (cancelled) return
        setAuthState('authenticated')
        const provinceItems = await listProvinces()
        if (!cancelled) setProvinces(provinceItems)

        const draftId = new URLSearchParams(window.location.search).get('draft')
        if (draftId) {
          const response = await getOwnedApartmentListing(draftId)
          if (cancelled) return
          setDraft(response.listing)
          setTransactionType(response.listing.transactionType)
          setForm(formFromDraft(response.listing))
        }
      } catch (bootError) {
        if (cancelled) return
        if (bootError instanceof ApiClientError && bootError.status === 401) {
          setAuthState('unauthenticated')
        } else {
          setAuthState('error')
          setError(message(bootError))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!form.provinceId) {
      setDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(form.provinceId)
      .then((items) => {
        if (!cancelled) setDistricts(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [form.provinceId])

  useEffect(() => {
    if (!form.districtId) {
      setNeighborhoods([])
      return
    }
    let cancelled = false
    void listNeighborhoods(form.districtId)
      .then((items) => {
        if (!cancelled) setNeighborhoods(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [form.districtId])

  async function createDraft() {
    setCreating(true)
    setError(null)
    try {
      const response = await createApartmentDraft(transactionType)
      setDraft(response.listing)
      setForm({ ...emptyForm })
      setSavedMessage('Taslak oluşturuldu. Şimdi bilgileri doldur.')
    } catch (createError) {
      setError(message(createError))
    } finally {
      setCreating(false)
    }
  }

  async function saveDetails() {
    if (!draft) return
    const validation = validationError(form, transactionType)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      const response = await updateApartmentDraftDetails(draft.id, inputFromForm(form, transactionType))
      setDraft(response.listing)
      setForm(formFromDraft(response.listing))
      setSavedMessage('İlan bilgileri kaydedildi.')
    } catch (saveError) {
      setError(message(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(file: File) {
    if (!draft) return
    setUploading(true)
    setError(null)
    try {
      const response = await uploadApartmentDraftImage(draft.id, file)
      setDraft(response.listing)
    } catch (uploadError) {
      setError(message(uploadError))
    } finally {
      setUploading(false)
    }
  }

  async function removeImage(imageId: string) {
    if (!draft) return
    setUploading(true)
    setError(null)
    try {
      const response = await removeApartmentDraftImage(draft.id, imageId)
      setDraft(response.listing)
    } catch (imageError) {
      setError(message(imageError))
    } finally {
      setUploading(false)
    }
  }

  async function makeCover(imageId: string) {
    if (!draft) return
    setUploading(true)
    setError(null)
    try {
      const response = await makeApartmentDraftImageCover(draft.id, imageId)
      setDraft(response.listing)
    } catch (imageError) {
      setError(message(imageError))
    } finally {
      setUploading(false)
    }
  }

  async function publish() {
    if (!draft) return
    setPublishing(true)
    setError(null)
    try {
      const response = await publishApartmentListing(draft.id)
      setDraft((current) => current ? { ...current, status: 'published' } : current)
      setPublishedAt(response.listing.publishedAt)
      setSavedMessage('İlan yayınlandı.')
    } catch (publishError) {
      setError(message(publishError))
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return <div className="public-list-state"><strong>İlan formu hazırlanıyor…</strong></div>
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="public-list-state">
        <strong>Daire ilanı vermek için giriş yap.</strong>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  if (authState === 'error') {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>Form yüklenemedi.</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="listing-create-card apartment-create-card">
        <p className="listing-create-eyebrow">İşlem türü</p>
        <h2>Daire ilanı türünü seç</h2>
        <div className="listing-category-grid">
          <button
            type="button"
            className={`listing-category-card${transactionType === 'sale' ? ' is-selected' : ''}`}
            onClick={() => setTransactionType('sale')}
          >
            <span>Satılık</span>
            <strong>Satılık daire</strong>
            <p>Fiyat, krediye uygunluk ve takas bilgileriyle yayınla.</p>
          </button>
          <button
            type="button"
            className={`listing-category-card${transactionType === 'rent' ? ' is-selected' : ''}`}
            onClick={() => setTransactionType('rent')}
          >
            <span>Kiralık</span>
            <strong>Kiralık daire</strong>
            <p>Kira ve depozito bilgileriyle yayınla.</p>
          </button>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="listing-create-submit" type="button" disabled={creating} onClick={() => void createDraft()}>
          {creating ? 'Taslak oluşturuluyor…' : 'Taslak oluştur'}
        </button>
      </div>
    )
  }

  return (
    <div className="apartment-form-layout">
      <div className="listing-create-card">
        <div className="apartment-form-header">
          <div>
            <p className="listing-create-eyebrow">{transactionType === 'sale' ? 'Satılık daire' : 'Kiralık daire'}</p>
            <h2>{draft.title ?? 'Yeni daire taslağı'}</h2>
          </div>
          <span className={`listing-status listing-status-${draft.status}`}>{editableStatusLabels[draft.status]}</span>
        </div>

        {savedMessage && <div className="listing-save-note" role="status">{savedMessage}</div>}
        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="listing-form-section">
          <h3>İlan bilgileri</h3>
          <div className="listing-form-grid">
            <label className="span-2">
              <span>Başlık</span>
              <input
                value={form.title}
                maxLength={120}
                placeholder="Örn. 2+1 geniş daire, merkezi konum"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label>
              <span>Fiyat (TL)</span>
              <input
                type="number"
                min={1}
                value={form.priceAmount}
                onChange={(event) => setForm({ ...form, priceAmount: event.target.value })}
              />
            </label>
            <label>
              <span>Telefon</span>
              <input
                value={form.contactPhoneE164}
                placeholder="+905551234567"
                onChange={(event) => setForm({ ...form, contactPhoneE164: event.target.value })}
              />
            </label>
            <label className="listing-checkbox-label span-2">
              <input
                type="checkbox"
                checked={form.showPhone}
                onChange={(event) => setForm({ ...form, showPhone: event.target.checked })}
              />
              <span>Telefon numaram ilan detayında gösterilsin</span>
            </label>
            <label className="span-2">
              <span>Açıklama</span>
              <textarea
                rows={4}
                maxLength={5000}
                value={form.description}
                placeholder="Dairenin konumu, durumu ve öne çıkan özellikleri…"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="listing-form-section">
          <h3>Konum</h3>
          <div className="listing-form-grid">
            <label>
              <span>İl</span>
              <select
                value={form.provinceId}
                onChange={(event) => setForm({
                  ...form,
                  provinceId: event.target.value,
                  districtId: '',
                  neighborhoodId: '',
                })}
              >
                <option value="">Seç</option>
                {provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>İlçe</span>
              <select
                value={form.districtId}
                disabled={!form.provinceId}
                onChange={(event) => setForm({
                  ...form,
                  districtId: event.target.value,
                  neighborhoodId: '',
                })}
              >
                <option value="">Seç</option>
                {districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Mahalle</span>
              <select
                value={form.neighborhoodId}
                disabled={!form.districtId}
                onChange={(event) => setForm({ ...form, neighborhoodId: event.target.value })}
              >
                <option value="">Seç</option>
                {neighborhoods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="listing-form-section">
          <h3>Daire özellikleri</h3>
          <div className="listing-form-grid">
            <label>
              <span>Oda sayısı</span>
              <select
                value={form.roomCount}
                onChange={(event) => setForm({ ...form, roomCount: event.target.value as ApartmentRoomCount })}
              >
                {roomCounts.map((room) => <option key={room} value={room}>{room}</option>)}
              </select>
            </label>
            <label>
              <span>Brüt m²</span>
              <input
                type="number"
                min={1}
                value={form.grossM2}
                onChange={(event) => setForm({ ...form, grossM2: event.target.value })}
              />
            </label>
            <label>
              <span>Net m²</span>
              <input
                type="number"
                min={1}
                value={form.netM2}
                onChange={(event) => setForm({ ...form, netM2: event.target.value })}
              />
            </label>
            <label>
              <span>Bina yaşı</span>
              <input
                type="number"
                min={0}
                value={form.buildingAge}
                onChange={(event) => setForm({ ...form, buildingAge: event.target.value })}
              />
            </label>
            <label>
              <span>Bulunduğu kat</span>
              <input
                type="number"
                min={-10}
                value={form.floor}
                onChange={(event) => setForm({ ...form, floor: event.target.value })}
              />
            </label>
            <label>
              <span>Kat sayısı</span>
              <input
                type="number"
                min={1}
                value={form.totalFloors}
                onChange={(event) => setForm({ ...form, totalFloors: event.target.value })}
              />
            </label>
            <label>
              <span>Isıtma</span>
              <select
                value={form.heating}
                onChange={(event) => setForm({ ...form, heating: event.target.value as ApartmentHeating })}
              >
                {Object.entries(heatingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Banyo sayısı</span>
              <input
                type="number"
                min={0}
                max={20}
                value={form.bathroomCount}
                onChange={(event) => setForm({ ...form, bathroomCount: event.target.value })}
              />
            </label>
            <label>
              <span>Mutfak</span>
              <select
                value={form.kitchen}
                onChange={(event) => setForm({ ...form, kitchen: event.target.value as ApartmentKitchen })}
              >
                <option value="open">Açık (Amerikan)</option>
                <option value="closed">Kapalı</option>
              </select>
            </label>
            <label>
              <span>Otopark</span>
              <select
                value={form.parking}
                onChange={(event) => setForm({ ...form, parking: event.target.value as ApartmentParking })}
              >
                {Object.entries(parkingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Kullanım durumu</span>
              <select
                value={form.occupancy}
                onChange={(event) => setForm({ ...form, occupancy: event.target.value as ApartmentOccupancy })}
              >
                {Object.entries(occupancyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Tapu durumu</span>
              <select
                value={form.deedStatus}
                onChange={(event) => setForm({ ...form, deedStatus: event.target.value as ApartmentDeedStatus })}
              >
                {Object.entries(deedLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {booleanFields.map(([key, label]) => (
              <label className="listing-checkbox-label" key={key}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
            {transactionType === 'sale' ? (
              <>
                <label>
                  <span>Krediye uygun</span>
                  <select
                    value={form.creditEligible}
                    onChange={(event) => setForm({ ...form, creditEligible: event.target.value })}
                  >
                    <option value="true">Evet</option>
                    <option value="false">Hayır</option>
                  </select>
                </label>
                <label>
                  <span>Takas</span>
                  <select
                    value={form.swapAvailable}
                    onChange={(event) => setForm({ ...form, swapAvailable: event.target.value })}
                  >
                    <option value="true">Takaslı</option>
                    <option value="false">Takassız</option>
                  </select>
                </label>
              </>
            ) : (
              <label>
                <span>Depozito (TL)</span>
                <input
                  type="number"
                  min={1}
                  value={form.depositAmount}
                  onChange={(event) => setForm({ ...form, depositAmount: event.target.value })}
                />
              </label>
            )}
          </div>
        </div>

        <div className="listing-form-section">
          <h3>Fotoğraflar {draft.images.length > 0 ? `· ${draft.images.length}/10` : ''}</h3>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || draft.images.length >= 10 || Boolean(publishedAt)}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadImage(file)
              event.target.value = ''
            }}
          />
          {draft.images.length > 0 && (
            <div className="listing-image-grid">
              {draft.images.map((image) => (
                <div className="listing-image-card" key={image.id}>
                  <img src={image.url} alt="İlan fotoğrafı" />
                  <button type="button" onClick={() => void makeCover(image.id)} disabled={uploading || Boolean(publishedAt)}>
                    Kapak yap
                  </button>
                  <button type="button" onClick={() => void removeImage(image.id)} disabled={uploading || Boolean(publishedAt)}>
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="listing-form-actions">
          <button className="listing-create-submit" type="button" disabled={saving || Boolean(publishedAt)} onClick={() => void saveDetails()}>
            {saving ? 'Kaydediliyor…' : 'Taslağı kaydet'}
          </button>
          {!publishedAt && (draft.status === 'draft' || draft.status === 'inactive') && (
            <button className="listing-create-secondary" type="button" disabled={publishing || saving} onClick={() => void publish()}>
              {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
            </button>
          )}
        </div>

        {publishedAt && (
          <div className="listing-save-note" role="status">
            <strong>İlan yayınlandı.</strong>
            <Link href={`/daire/${draft.id}`}>İlanı gör</Link>
            <Link href="/ilanlarim">İlanlarıma git</Link>
          </div>
        )}
      </div>
    </div>
  )
}
