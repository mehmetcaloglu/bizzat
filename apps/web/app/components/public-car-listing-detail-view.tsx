import Link from 'next/link'
import type {
  PublicCarListingAttributes,
  PublicCarListingDetail,
} from '../../lib/api-client'
import { PublicCarListingGallery } from './public-car-listing-gallery'

const fuelLabels: Record<PublicCarListingAttributes['fuelType'], string> = {
  benzin: 'Benzin',
  dizel: 'Dizel',
  lpg: 'LPG',
  hibrit: 'Hibrit',
  elektrik: 'Elektrik',
}

const transmissionLabels: Record<PublicCarListingAttributes['transmission'], string> = {
  manuel: 'Manuel',
  otomatik: 'Otomatik',
  yari_otomatik: 'Yarı otomatik',
}

const bodyTypeLabels: Record<PublicCarListingAttributes['bodyType'], string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  station_wagon: 'Station wagon',
  suv: 'SUV',
  coupe: 'Coupe',
  cabrio: 'Cabrio',
  mpv: 'MPV',
  roadster: 'Roadster',
  diger: 'Diğer',
}

const conditionLabels: Record<PublicCarListingAttributes['vehicleCondition'], string> = {
  second_hand: 'İkinci el',
  imported_new: 'İthal sıfır',
  new: 'Sıfır',
}

const drivetrainLabels: Record<PublicCarListingAttributes['drivetrain'], string> = {
  front: 'Önden çekiş',
  rear: 'Arkadan itiş',
  four_wd: '4 çeker',
  awd: 'AWD',
}

const plateLabels: Record<PublicCarListingAttributes['plateNationality'], string> = {
  tr: 'Türkiye',
  ma: 'Mavi plaka',
}

const paintLabels: Record<PublicCarListingAttributes['paintStatus'], string> = {
  original: 'Orijinal',
  partial: 'Kısmi boya',
  painted: 'Boyalı',
}

const replacementLabels: Record<PublicCarListingAttributes['replacementStatus'], string> = {
  none: 'Yok',
  replaced: 'Var',
}

export function formatTry(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' TL'
}

export function formatKm(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value) + ' km'
}

export function formatPhone(value: string): string {
  return value.replace(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/, '+90 $1 $2 $3 $4')
}

function yesNo(value: boolean): string {
  return value ? 'Var' : 'Yok'
}

interface PublicCarListingDetailViewProps {
  listing: PublicCarListingDetail
  phone: string | null
  phoneLoading: boolean
  phoneError: string | null
  onShowPhone: () => void
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="listing-detail-spec">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function PublicCarListingDetailView({
  listing,
  phone,
  phoneLoading,
  phoneError,
  onShowPhone,
}: PublicCarListingDetailViewProps) {
  const attributes = listing.attributes
  const vehiclePath = [
    listing.vehicle.brandName,
    listing.vehicle.seriesName,
    ...listing.vehicle.selectionPath.map((node) => node.name),
  ].join(' · ')

  return (
    <article className="listing-detail">
      <nav className="listing-detail-breadcrumb" aria-label="İlan yolu">
        <Link href="/">Ana sayfa</Link>
        <span aria-hidden="true">/</span>
        <Link href="/otomobil">Satılık otomobil</Link>
      </nav>

      <header className="listing-detail-heading">
        <div>
          <p className="listing-create-eyebrow">{vehiclePath}</p>
          <h1>{listing.title}</h1>
          <p className="listing-detail-location">
            {listing.location.provinceName} · {listing.location.districtName} ·{' '}
            {listing.location.neighborhoodName}
          </p>
        </div>
        <strong className="listing-detail-price">{formatTry(listing.priceAmount)}</strong>
      </header>

      <div className="listing-detail-layout">
        <div className="listing-detail-main">
          <PublicCarListingGallery images={listing.images} title={listing.title} />

          <section className="listing-detail-section" aria-labelledby="vehicle-information-heading">
            <div className="listing-detail-section-heading">
              <h2 id="vehicle-information-heading">Araç bilgileri</h2>
              <span>{listing.vehicle.modelName}</span>
            </div>
            <dl className="listing-detail-specs">
              <Spec label="Model yılı" value={String(listing.modelYear)} />
              <Spec label="Kilometre" value={formatKm(listing.mileageKm)} />
              <Spec label="Yakıt" value={fuelLabels[attributes.fuelType]} />
              <Spec label="Vites" value={transmissionLabels[attributes.transmission]} />
              <Spec label="Kasa tipi" value={bodyTypeLabels[attributes.bodyType]} />
              <Spec label="Araç durumu" value={conditionLabels[attributes.vehicleCondition]} />
              <Spec label="Motor gücü" value={`${attributes.enginePowerHp} HP`} />
              <Spec
                label="Motor hacmi"
                value={attributes.engineDisplacementCc === null
                  ? 'Elektrikli'
                  : `${new Intl.NumberFormat('tr-TR').format(attributes.engineDisplacementCc)} cc`}
              />
              <Spec label="Çekiş" value={drivetrainLabels[attributes.drivetrain]} />
              <Spec label="Renk" value={attributes.color} />
              <Spec label="Garanti" value={yesNo(attributes.underWarranty)} />
              <Spec label="Ağır hasar kaydı" value={yesNo(attributes.heavyDamageRecorded)} />
              <Spec label="Plaka / uyruk" value={plateLabels[attributes.plateNationality]} />
              <Spec label="Takas" value={yesNo(attributes.swapAvailable)} />
              <Spec label="Boya durumu" value={paintLabels[attributes.paintStatus]} />
              <Spec label="Değişen parça" value={replacementLabels[attributes.replacementStatus]} />
            </dl>
          </section>

          <section className="listing-detail-section" aria-labelledby="listing-description-heading">
            <h2 id="listing-description-heading">Açıklama</h2>
            <p className="listing-detail-description">{listing.description}</p>
          </section>
        </div>

        <aside className="listing-detail-contact" aria-label="İlan sahibi ve iletişim">
          <p className="listing-create-eyebrow">İlan veren</p>
          <strong>Bireysel ilan sahibi</strong>
          <p>
            Bizzat&apos;ta ilanlar bireysel satıcılar tarafından oluşturulur. Aracı görmeden ödeme
            yapma; satıcıyla doğrudan görüş.
          </p>

          {listing.contact.showPhone ? (
            <div className="listing-detail-contact-action">
              {phone ? (
                <>
                  <a className="listing-detail-phone" href={`tel:${phone}`}>
                    {formatPhone(phone)}
                  </a>
                  <span>Numaraya dokunarak ilan sahibini arayabilirsin.</span>
                </>
              ) : (
                <button type="button" disabled={phoneLoading} onClick={onShowPhone}>
                  {phoneLoading ? 'Telefon yükleniyor…' : 'Telefonu göster'}
                </button>
              )}
              {phoneError && <span className="field-error" role="alert">{phoneError}</span>}
            </div>
          ) : (
            <p className="listing-detail-contact-muted">
              İlan sahibi telefon numarasını paylaşmadı.
            </p>
          )}

          <Link className="listing-detail-back" href="/otomobil">
            Diğer otomobil ilanlarına dön
          </Link>
        </aside>
      </div>
    </article>
  )
}
