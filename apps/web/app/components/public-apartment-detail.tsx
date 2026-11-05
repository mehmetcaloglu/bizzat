'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiClientError,
  getPublicApartmentContact,
  getPublicApartmentListing,
  type ApartmentDeedStatus,
  type ApartmentFloorLabel,
  type ApartmentHeating,
  type ApartmentKitchen,
  type ApartmentOccupancy,
  type ApartmentParking,
  type PublicApartmentListingDetail,
} from '../../lib/api-client'
import { PublicCarListingGallery } from './public-car-listing-gallery'
import { ReportListingForm } from './report-listing-form'

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

const floorLabels: Record<ApartmentFloorLabel, string> = {
  garden: 'Bahçe katı',
  basement: 'Bodrum',
  ground: 'Zemin',
  entrance: 'Giriş',
  high_entrance: 'Yüksek giriş',
  detached: 'Müstakil',
  villa: 'Villa tipi',
  attic: 'Çatı katı',
}

const kitchenLabels: Record<ApartmentKitchen, string> = {
  open: 'Açık (Amerikan)',
  closed: 'Kapalı',
}

const parkingLabels: Record<ApartmentParking, string> = {
  none: 'Yok',
  open: 'Açık otopark',
  closed: 'Kapalı otopark',
  both: 'Açık ve kapalı otopark',
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

function formatTry(value: number, rent: boolean): string {
  return new Intl.NumberFormat('tr-TR').format(value) + (rent ? ' TL/ay' : ' TL')
}

function formatPhone(value: string): string {
  return value.replace(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/, '+90 $1 $2 $3 $4')
}

function yesNo(value: boolean): string {
  return value ? 'Evet' : 'Hayır'
}

interface PublicApartmentDetailProps {
  listingId: string
}

export function PublicApartmentDetail({ listingId }: PublicApartmentDetailProps) {
  const [listing, setListing] = useState<PublicApartmentListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const [phone, setPhone] = useState<string | null>(null)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void getPublicApartmentListing(listingId)
      .then((response) => {
        if (!cancelled) setListing(response.listing)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof ApiClientError
          ? loadError.message
          : 'İlan şu anda yüklenemiyor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listingId, retryVersion])

  async function showPhone() {
    setPhoneLoading(true)
    setPhoneError(null)
    try {
      const response = await getPublicApartmentContact(listingId)
      setPhone(response.phoneE164)
    } catch (phoneLoadError) {
      setPhoneError(phoneLoadError instanceof ApiClientError
        ? phoneLoadError.message
        : 'Telefon numarası yüklenemedi.')
    } finally {
      setPhoneLoading(false)
    }
  }

  if (loading) {
    return <div className="public-list-state"><strong>İlan yükleniyor…</strong></div>
  }

  if (error || !listing) {
    return (
      <div className="public-list-state public-list-error" role="alert">
        <strong>İlan bulunamadı.</strong>
        <span>{error ?? 'Bu ilan yayında değil veya kaldırılmış olabilir.'}</span>
        <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
          Tekrar dene
        </button>
        <Link href="/daire">Daire ilanlarına dön</Link>
      </div>
    )
  }

  const rent = listing.type === 'apartment_rent'
  const attributes = listing.attributes
  const floorText = attributes.floorLabel
    ? floorLabels[attributes.floorLabel]
    : listing.floor === null ? 'Belirtilmedi' : String(listing.floor)

  return (
    <article className="listing-detail apartment-detail">
      <div className="listing-detail-breadcrumb">
        <Link href="/daire">Daireler</Link>
        <span>/</span>
        <span>{rent ? 'Kiralık Daire' : 'Satılık Daire'}</span>
      </div>

      <div className="listing-detail-layout">
        <div className="listing-detail-main">
          <PublicCarListingGallery images={listing.images} title={listing.title} />

          <div className="listing-detail-title-block">
            <div className="apartment-card-topline">
              <span className="apartment-type-badge">{rent ? 'Kiralık' : 'Satılık'}</span>
              <span>{listing.roomCount === 'studio' ? 'Stüdyo' : listing.roomCount}</span>
            </div>
            <h1>{listing.title}</h1>
            <p className="listing-detail-location">
              {listing.location.neighborhoodName} · {listing.location.districtName} / {listing.location.provinceName}
            </p>
          </div>

          <section className="listing-detail-price-box">
            <strong>{formatTry(listing.priceAmount, rent)}</strong>
            <span>{rent && attributes.depositAmount !== null
              ? `Depozito: ${formatTry(attributes.depositAmount, false)}`
              : `${listing.grossM2} m² brüt`}</span>
          </section>

          <section className="listing-detail-section">
            <h2>Daire bilgileri</h2>
            <dl className="listing-detail-attributes">
              <div><dt>Oda sayısı</dt><dd>{listing.roomCount === 'studio' ? 'Stüdyo' : listing.roomCount}</dd></div>
              <div><dt>Brüt m²</dt><dd>{listing.grossM2} m²</dd></div>
              <div><dt>Net m²</dt><dd>{listing.netM2 === null ? 'Belirtilmedi' : `${listing.netM2} m²`}</dd></div>
              <div><dt>Bina yaşı</dt><dd>{listing.buildingAge === null ? 'Belirtilmedi' : listing.buildingAge}</dd></div>
              <div><dt>Bulunduğu kat</dt><dd>{floorText}</dd></div>
              <div><dt>Kat sayısı</dt><dd>{listing.totalFloors ?? 'Belirtilmedi'}</dd></div>
              <div><dt>Isıtma</dt><dd>{heatingLabels[attributes.heating]}</dd></div>
              <div><dt>Banyo sayısı</dt><dd>{attributes.bathroomCount}</dd></div>
              <div><dt>Mutfak</dt><dd>{kitchenLabels[attributes.kitchen]}</dd></div>
              <div><dt>Balkon</dt><dd>{yesNo(attributes.balcony)}</dd></div>
              <div><dt>Asansör</dt><dd>{yesNo(attributes.elevator)}</dd></div>
              <div><dt>Otopark</dt><dd>{parkingLabels[attributes.parking]}</dd></div>
              <div><dt>Eşyalı</dt><dd>{yesNo(attributes.furnished)}</dd></div>
              <div><dt>Kullanım durumu</dt><dd>{occupancyLabels[attributes.occupancy]}</dd></div>
              <div><dt>Site içinde</dt><dd>{yesNo(attributes.inSite)}</dd></div>
              <div><dt>Tapu durumu</dt><dd>{deedLabels[attributes.deedStatus]}</dd></div>
              {!rent && attributes.creditEligible !== null && (
                <div><dt>Krediye uygun</dt><dd>{yesNo(attributes.creditEligible)}</dd></div>
              )}
              {!rent && attributes.swapAvailable !== null && (
                <div><dt>Takas</dt><dd>{yesNo(attributes.swapAvailable)}</dd></div>
              )}
            </dl>
          </section>

          <section className="listing-detail-section">
            <h2>İlan açıklaması</h2>
            <p className="listing-detail-description">{listing.description}</p>
          </section>
        </div>

        <aside className="listing-detail-aside">
          <div className="listing-detail-contact">
            <span className="listing-detail-contact-label">İlan sahibiyle iletişim</span>
            {listing.contact.showPhone ? (
              <div className="listing-detail-contact-action">
                {phone ? (
                  <a className="listing-detail-phone" href={`tel:${phone}`}>{formatPhone(phone)}</a>
                ) : (
                  <button type="button" disabled={phoneLoading} onClick={() => void showPhone()}>
                    {phoneLoading ? 'Telefon yükleniyor…' : 'Telefonu göster'}
                  </button>
                )}
                {phoneError && <span className="field-error" role="alert">{phoneError}</span>}
              </div>
            ) : (
              <p className="listing-detail-contact-muted">İlan sahibi telefon numarasını paylaşmadı.</p>
            )}
            <Link className="listing-detail-back" href="/daire">Diğer daire ilanlarına dön</Link>
          </div>
        </aside>
      </div>

      <ReportListingForm listingId={listing.id} />
    </article>
  )
}
