'use client'

import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import {
  ApiClientError,
  listDistricts,
  listNeighborhoods,
  listProvinces,
  updateCarSaleDraftCoreDetails,
  uploadCarSaleDraftImage,
  type CarBodyType,
  type CarFuelType,
  type CarSaleDraftResponse,
  type CarTransmission,
  type LocationReferenceItem,
  type NeighborhoodReferenceItem,
  type ProvinceReferenceItem,
} from '../../../lib/api-client'

interface CarListingDetailsFormProps {
  listing: CarSaleDraftResponse['listing'] | null
  onSaved: (listing: CarSaleDraftResponse['listing']) => void
}

type LoadingTarget = 'provinces' | 'districts' | 'neighborhoods' | 'save' | null

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'Bilgiler kaydedilemedi. Tekrar deneyebilirsin.'
}

export function CarListingDetailsForm({ listing, onSaved }: CarListingDetailsFormProps) {
  const [title, setTitle] = useState('')
  const [modelYear, setModelYear] = useState('')
  const [mileageKm, setMileageKm] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [fuelType, setFuelType] = useState<CarFuelType | ''>('')
  const [transmission, setTransmission] = useState<CarTransmission | ''>('')
  const [bodyType, setBodyType] = useState<CarBodyType | ''>('')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [showPhone, setShowPhone] = useState(true)
  const [provinceId, setProvinceId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [provinces, setProvinces] = useState<ProvinceReferenceItem[]>([])
  const [districts, setDistricts] = useState<LocationReferenceItem[]>([])
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodReferenceItem[]>([])
  const [loadingTarget, setLoadingTarget] = useState<LoadingTarget>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!listing) {
      setTitle('')
      setModelYear('')
      setMileageKm('')
      setPriceAmount('')
      setFuelType('')
      setTransmission('')
      setBodyType('')
      setColor('')
      setDescription('')
      setContactPhone('')
      setShowPhone(true)
      setProvinceId('')
      setDistrictId('')
      setNeighborhoodId('')
      setProvinces([])
      setDistricts([])
      setNeighborhoods([])
      setLoadingTarget(null)
      setError(null)
      setMessage(null)
      return () => {
        cancelled = true
      }
    }

    const details = listing.details
    setTitle(listing.title ?? '')
    setModelYear(details ? String(details.modelYear) : '')
    setMileageKm(details ? String(details.mileageKm) : '')
    setPriceAmount(details ? String(details.priceAmount) : '')
    setFuelType(listing.attributes?.fuelType ?? '')
    setTransmission(listing.attributes?.transmission ?? '')
    setBodyType(listing.attributes?.bodyType ?? '')
    setColor(listing.attributes?.color ?? '')
    setDescription(details?.description ?? '')
    setContactPhone(listing.contact?.phoneE164 ?? '')
    setShowPhone(listing.contact?.showPhone ?? true)
    setProvinceId(details?.location.province.id ?? '')
    setDistrictId(details?.location.district.id ?? '')
    setNeighborhoodId(details?.location.neighborhood.id ?? '')
    setDistricts([])
    setNeighborhoods([])
    setError(null)

    async function loadLocationOptions() {
      setLoadingTarget('provinces')
      try {
        const provinceItems = await listProvinces()
        if (cancelled) return
        setProvinces(provinceItems)

        if (!details) return
        const districtItems = await listDistricts(details.location.province.id)
        if (cancelled) return
        setDistricts(districtItems)

        const neighborhoodItems = await listNeighborhoods(details.location.district.id)
        if (cancelled) return
        setNeighborhoods(neighborhoodItems)
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError))
      } finally {
        if (!cancelled) setLoadingTarget(null)
      }
    }

    void loadLocationOptions()
    return () => {
      cancelled = true
    }
  }, [listing?.id, listing?.details, listing?.title, listing?.attributes, listing?.contact])

  async function handleProvince(nextProvinceId: string) {
    setProvinceId(nextProvinceId)
    setDistrictId('')
    setNeighborhoodId('')
    setDistricts([])
    setNeighborhoods([])
    setError(null)
    setMessage(null)
    if (!nextProvinceId) return

    setLoadingTarget('districts')
    try {
      setDistricts(await listDistricts(nextProvinceId))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoadingTarget(null)
    }
  }

  async function handleDistrict(nextDistrictId: string) {
    setDistrictId(nextDistrictId)
    setNeighborhoodId('')
    setNeighborhoods([])
    setError(null)
    setMessage(null)
    if (!nextDistrictId) return

    setLoadingTarget('neighborhoods')
    try {
      setNeighborhoods(await listNeighborhoods(nextDistrictId))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoadingTarget(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!listing || loadingTarget === 'save') return

    const parsedModelYear = Number(modelYear)
    const parsedMileageKm = Number(mileageKm)
    const parsedPriceAmount = Number(priceAmount)
    if (
      !Number.isInteger(parsedModelYear)
      || !Number.isInteger(parsedMileageKm)
      || !Number.isInteger(parsedPriceAmount)
      || title.trim().length < 10
      || !fuelType
      || !transmission
      || !bodyType
      || color.trim().length < 2
      || !/^\+90[0-9]{10}$/.test(contactPhone.trim())
      || !provinceId
      || !districtId
      || !neighborhoodId
    ) {
      setError('Başlık, araç özellikleri, iletişim ve konum dahil tüm alanları geçerli şekilde doldur.')
      return
    }

    setError(null)
    setMessage(null)
    setLoadingTarget('save')
    try {
      const response = await updateCarSaleDraftCoreDetails(listing.id, {
        title: title.trim(),
        modelYear: parsedModelYear,
        mileageKm: parsedMileageKm,
        priceAmount: parsedPriceAmount,
        fuelType,
        transmission,
        bodyType,
        color: color.trim(),
        provinceId,
        districtId,
        neighborhoodId,
        description,
        contactPhoneE164: contactPhone.trim(),
        showPhone,
      })
      onSaved(response.listing)
      setMessage('İlan bilgileri kaydedildi. Fotoğrafları da ekleyerek taslağını tamamlayabilirsin.')
    } catch (saveError) {
      if (saveError instanceof ApiClientError && saveError.code === 'LISTING_LOCATION_INVALID') {
        setProvinceId('')
        setDistrictId('')
        setNeighborhoodId('')
        setDistricts([])
        setNeighborhoods([])
        setError('Konum bilgisi güncellendi. İl, ilçe ve mahalleyi yeniden seç.')
      } else if (saveError instanceof ApiClientError && saveError.code === 'LISTING_NOT_EDITABLE') {
        setError('Bu taslak artık düzenlenemiyor.')
      } else if (saveError instanceof ApiClientError && saveError.code === 'UNAUTHENTICATED') {
        setError('Oturumun sona erdi. Devam etmek için yeniden giriş yap.')
      } else {
        setError(errorMessage(saveError))
      }
    } finally {
      setLoadingTarget(null)
    }
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    if (!listing || uploading) return
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const remaining = Math.max(0, 10 - listing.images.length)
    if (remaining === 0) {
      setError('Bu ilana zaten 10 fotoğraf eklenmiş.')
      return
    }

    const selected = files.slice(0, remaining)
    const invalid = selected.find((file) =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8_000_000
    )
    if (invalid) {
      setError('Fotoğraflar JPG, PNG veya WebP olmalı ve her biri en fazla 8 MB olabilir.')
      return
    }

    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      let latest = listing
      for (const file of selected) {
        const response = await uploadCarSaleDraftImage(latest.id, file)
        latest = response.listing
        onSaved(latest)
      }
      setMessage(`${selected.length} fotoğraf eklendi.`)
    } catch (uploadError) {
      setError(errorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  const locked = listing === null
  const saving = loadingTarget === 'save'
  const maxModelYear = new Date().getFullYear() + 1

  return (
    <section className="listing-details-step" aria-labelledby="listing-details-title" aria-disabled={locked}>
      <div className="listing-details-heading">
        <span className="listing-details-step-number">2</span>
        <div>
          <p className="listing-create-eyebrow">İkinci adım</p>
          <h2 id="listing-details-title">İlan bilgileri</h2>
          <p>
            {locked
              ? 'Önce aracını seçip taslağı oluştur. Bu alanlar sonra açılacak.'
              : 'Başlık, araç özellikleri, konum ve iletişim bilgisini tamamla; ardından fotoğraflarını ekle.'}
          </p>
        </div>
      </div>

      <form className="listing-details-form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset disabled={locked || saving}>
          <label className="full-width-field">
            <span>İlan başlığı</span>
            <input
              name="title"
              minLength={10}
              maxLength={120}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Örn. 2024 Renault Clio Evolution temiz aile aracı"
            />
            <small>{title.length}/120</small>
          </label>

          <div className="listing-details-grid">
            <label>
              <span>Model yılı</span>
              <input
                name="modelYear"
                type="number"
                min={1900}
                max={maxModelYear}
                step={1}
                inputMode="numeric"
                required
                value={modelYear}
                onChange={(event) => setModelYear(event.target.value)}
                placeholder="2022"
              />
            </label>

            <label>
              <span>Kilometre</span>
              <div className="field-with-suffix">
                <input
                  name="mileageKm"
                  type="number"
                  min={0}
                  max={10_000_000}
                  step={1}
                  inputMode="numeric"
                  required
                  value={mileageKm}
                  onChange={(event) => setMileageKm(event.target.value)}
                  placeholder="45000"
                />
                <span>km</span>
              </div>
            </label>

            <label>
              <span>Fiyat</span>
              <div className="field-with-suffix">
                <input
                  name="priceAmount"
                  type="number"
                  min={1}
                  max={9_999_999_999}
                  step={1}
                  inputMode="numeric"
                  required
                  value={priceAmount}
                  onChange={(event) => setPriceAmount(event.target.value)}
                  placeholder="1250000"
                />
                <span>TL</span>
              </div>
            </label>
          </div>

          <div className="listing-details-grid attribute-grid">
            <label>
              <span>Yakıt</span>
              <select value={fuelType} required onChange={(event) => setFuelType(event.target.value as CarFuelType)}>
                <option value="">Yakıt seç</option>
                <option value="benzin">Benzin</option>
                <option value="dizel">Dizel</option>
                <option value="lpg">LPG</option>
                <option value="hibrit">Hibrit</option>
                <option value="elektrik">Elektrik</option>
              </select>
            </label>

            <label>
              <span>Vites</span>
              <select value={transmission} required onChange={(event) => setTransmission(event.target.value as CarTransmission)}>
                <option value="">Vites seç</option>
                <option value="manuel">Manuel</option>
                <option value="otomatik">Otomatik</option>
                <option value="yari_otomatik">Yarı otomatik</option>
              </select>
            </label>

            <label>
              <span>Kasa tipi</span>
              <select value={bodyType} required onChange={(event) => setBodyType(event.target.value as CarBodyType)}>
                <option value="">Kasa tipi seç</option>
                <option value="hatchback">Hatchback</option>
                <option value="sedan">Sedan</option>
                <option value="station_wagon">Station Wagon</option>
                <option value="suv">SUV</option>
                <option value="coupe">Coupe</option>
                <option value="cabrio">Cabrio</option>
                <option value="mpv">MPV</option>
                <option value="diger">Diğer</option>
              </select>
            </label>

            <label>
              <span>Renk</span>
              <input
                value={color}
                minLength={2}
                maxLength={40}
                required
                onChange={(event) => setColor(event.target.value)}
                placeholder="Beyaz"
              />
            </label>
          </div>

          <div className="listing-details-grid location-grid">
            <label>
              <span>İl</span>
              <select
                name="provinceId"
                required
                value={provinceId}
                onChange={(event) => void handleProvince(event.target.value)}
              >
                <option value="">İl seç</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>{province.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>İlçe</span>
              <select
                name="districtId"
                required
                disabled={!provinceId || loadingTarget === 'districts'}
                value={districtId}
                onChange={(event) => void handleDistrict(event.target.value)}
              >
                <option value="">{loadingTarget === 'districts' ? 'Yükleniyor…' : 'İlçe seç'}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Mahalle</span>
              <select
                name="neighborhoodId"
                required
                disabled={!districtId || loadingTarget === 'neighborhoods'}
                value={neighborhoodId}
                onChange={(event) => setNeighborhoodId(event.target.value)}
              >
                <option value="">{loadingTarget === 'neighborhoods' ? 'Yükleniyor…' : 'Mahalle seç'}</option>
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood.id} value={neighborhood.id}>{neighborhood.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="description-field">
            <span>Açıklama</span>
            <textarea
              name="description"
              minLength={20}
              maxLength={5000}
              required
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Aracın kullanımını, bakım durumunu ve alıcının bilmesi gereken temel bilgileri yaz."
            />
            <small>{description.length}/5000</small>
          </label>

          <div className="contact-panel">
            <label>
              <span>İletişim telefonu</span>
              <input
                type="tel"
                inputMode="tel"
                required
                pattern="\+90[0-9]{10}"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+905551234567"
              />
            </label>
            <label className="phone-visibility">
              <input
                type="checkbox"
                checked={showPhone}
                onChange={(event) => setShowPhone(event.target.checked)}
              />
              <span>Telefon numaramı ilanda göster</span>
            </label>
          </div>
        </fieldset>

        <div className="photo-uploader" aria-disabled={locked}>
          <div>
            <span className="photo-uploader-title">Fotoğraflar</span>
            <p>JPG, PNG veya WebP · fotoğraf başına en fazla 8 MB · en fazla 10 fotoğraf</p>
          </div>
          <label className="photo-upload-button" aria-disabled={locked || uploading}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={locked || uploading}
              onChange={(event) => void handlePhotos(event)}
            />
            {uploading ? 'Yükleniyor…' : 'Fotoğraf ekle'}
          </label>
        </div>

        {listing && listing.images.length > 0 && (
          <div className="photo-grid" aria-label="Yüklenen fotoğraflar">
            {listing.images.map((image, index) => (
              <div className="photo-tile" key={image.id}>
                <div
                  className="photo-tile-image"
                  role="img"
                  aria-label={`İlan fotoğrafı ${index + 1}`}
                  style={{ backgroundImage: `url("${image.url}")` }}
                />
                <span>{index === 0 ? 'Kapak fotoğrafı' : `Fotoğraf ${index + 1}`}</span>
              </div>
            ))}
          </div>
        )}

        <div className="listing-details-actions">
          <div aria-live="polite">
            {locked && <span className="listing-details-hint">Araç taslağı oluşturulduğunda bu adım açılır.</span>}
            {error && <span className="listing-details-error" role="alert">{error}</span>}
            {message && <span className="listing-details-saved" role="status">{message}</span>}
          </div>
          <button className="primary-action" type="submit" disabled={locked || saving}>
            {saving ? 'Kaydediliyor…' : 'İlanı kaydet'}
          </button>
        </div>
      </form>
    </section>
  )
}
