'use client'

import { type FormEvent, useEffect, useState } from 'react'
import {
  ApiClientError,
  listDistricts,
  listNeighborhoods,
  listProvinces,
  updateCarSaleDraftCoreDetails,
  type CarSaleDraftResponse,
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
  const [modelYear, setModelYear] = useState('')
  const [mileageKm, setMileageKm] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [description, setDescription] = useState('')
  const [provinceId, setProvinceId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [provinces, setProvinces] = useState<ProvinceReferenceItem[]>([])
  const [districts, setDistricts] = useState<LocationReferenceItem[]>([])
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodReferenceItem[]>([])
  const [loadingTarget, setLoadingTarget] = useState<LoadingTarget>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!listing) {
      setModelYear('')
      setMileageKm('')
      setPriceAmount('')
      setDescription('')
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
    setModelYear(details ? String(details.modelYear) : '')
    setMileageKm(details ? String(details.mileageKm) : '')
    setPriceAmount(details ? String(details.priceAmount) : '')
    setDescription(details?.description ?? '')
    setProvinceId(details?.location.province.id ?? '')
    setDistrictId(details?.location.district.id ?? '')
    setNeighborhoodId(details?.location.neighborhood.id ?? '')
    setDistricts([])
    setNeighborhoods([])
    setError(null)
    setMessage(null)

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
  }, [listing?.id, listing?.details])

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
      || !provinceId
      || !districtId
      || !neighborhoodId
    ) {
      setError('Tüm ilan bilgilerini geçerli değerlerle doldur.')
      return
    }

    setError(null)
    setMessage(null)
    setLoadingTarget('save')
    try {
      const response = await updateCarSaleDraftCoreDetails(listing.id, {
        modelYear: parsedModelYear,
        mileageKm: parsedMileageKm,
        priceAmount: parsedPriceAmount,
        provinceId,
        districtId,
        neighborhoodId,
        description,
      })
      onSaved(response.listing)
      setMessage('İlan bilgileri kaydedildi.')
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
              : 'Aracın temel ilan bilgilerini doldur. Diğer özellikleri sonraki adımlarda ekleyeceğiz.'}
          </p>
        </div>
      </div>

      <form className="listing-details-form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset disabled={locked || saving}>
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
                  placeholder="45.000"
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
                  placeholder="1.250.000"
                />
                <span>TL</span>
              </div>
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
        </fieldset>

        <div className="listing-details-actions">
          <div aria-live="polite">
            {locked && <span className="listing-details-hint">Araç taslağı oluşturulduğunda bu adım açılır.</span>}
            {error && <span className="listing-details-error" role="alert">{error}</span>}
            {message && <span className="listing-details-saved" role="status">{message}</span>}
          </div>
          <button className="primary-action" type="submit" disabled={locked || saving}>
            {saving ? 'Kaydediliyor…' : 'Bilgileri kaydet'}
          </button>
        </div>
      </form>
    </section>
  )
}
