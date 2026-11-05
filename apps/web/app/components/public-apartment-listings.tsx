'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ApiClientError,
  listDistricts,
  listProvinces,
  listPublicApartmentListings,
  type ApartmentHeating,
  type ApartmentParking,
  type ApartmentTransactionType,
  type LocationReferenceItem,
  type PublicApartmentListingItem,
  type PublicApartmentListingSort,
} from '../../lib/api-client'
import {
  activeApartmentFilterCount,
  apartmentRoomCounts as roomCounts,
  emptyApartmentFeedForm,
  filtersFromApartmentForm,
  formFromApartmentFilters,
  parseApartmentFeedQuery,
  toApartmentFeedSearchParams,
  validateApartmentFeedForm,
  type ApartmentFeedFormValues,
} from './apartment-feed-query'

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

const sortLabels: Record<PublicApartmentListingSort, string> = {
  newest: 'En yeni',
  oldest: 'En eski',
  price_asc: 'Fiyat artan',
  price_desc: 'Fiyat azalan',
  gross_m2_asc: 'm² artan',
  gross_m2_desc: 'm² azalan',
}

function formatTry(value: number, rent: boolean): string {
  return new Intl.NumberFormat('tr-TR').format(value) + (rent ? ' TL/ay' : ' TL')
}

export function PublicApartmentCard({ item }: { item: PublicApartmentListingItem }) {
  const rent = item.type === 'apartment_rent'
  return (
    <Link className="listing-card-link" href={`/daire/${item.id}`}>
      <article className="listing-card apartment-card">
        {item.imageUrl ? (
          <div
            className="listing-card-media"
            role="img"
            aria-label={item.title}
            style={{ backgroundImage: `url("${item.imageUrl}")` }}
          />
        ) : (
          <div className="listing-card-media listing-card-placeholder" aria-hidden="true">
            <span>D</span>
          </div>
        )}
        <div className="listing-card-body">
          <div className="apartment-card-topline">
            <span className="apartment-type-badge">{rent ? 'Kiralık' : 'Satılık'}</span>
            <span>{item.location.districtName}</span>
          </div>
          <h3>{item.title}</h3>
          <strong className="listing-card-price">{formatTry(item.priceAmount, rent)}</strong>
          <div className="listing-card-specs">
            <span>{item.roomCount === 'studio' ? 'Stüdyo' : item.roomCount}</span>
            <span>{item.grossM2} m²</span>
            {item.floor !== null && <span>{item.floor}. kat</span>}
            <span>{heatingLabels[item.attributes.heating]}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export function PublicApartmentListings({ limit = 12 }: { limit?: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const { transactionType, sort, filters } = parseApartmentFeedQuery(
    new URLSearchParams(queryString),
  )
  const filtersKey = JSON.stringify(filters)
  const lastFiltersKey = useRef(filtersKey)
  const [draft, setDraft] = useState<ApartmentFeedFormValues>(() => formFromApartmentFilters(filters))
  const [provinces, setProvinces] = useState<LocationReferenceItem[]>([])
  const [districts, setDistricts] = useState<LocationReferenceItem[]>([])
  const [items, setItems] = useState<PublicApartmentListingItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    if (lastFiltersKey.current === filtersKey) return
    lastFiltersKey.current = filtersKey
    setDraft(formFromApartmentFilters(
      parseApartmentFeedQuery(new URLSearchParams(queryString)).filters,
    ))
  }, [filtersKey, queryString])

  useEffect(() => {
    void listProvinces().then(setProvinces).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!draft.provinceId) {
      setDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(draft.provinceId)
      .then((result) => {
        if (!cancelled) setDistricts(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [draft.provinceId])

  useEffect(() => {
    let cancelled = false
    const query = parseApartmentFeedQuery(new URLSearchParams(queryString))
    setLoading(true)
    setError(null)
    setNextCursor(null)

    void listPublicApartmentListings({
      limit,
      sort: query.sort,
      filters: query.filters,
    })
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof ApiClientError
          ? loadError.message
          : 'Daire ilanları şu anda yüklenemiyor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [limit, queryString, retryVersion])

  function navigate(
    nextTransactionType: ApartmentTransactionType,
    nextSort: PublicApartmentListingSort,
    nextFilters: typeof filters,
  ) {
    setFormError(null)
    const params = toApartmentFeedSearchParams(nextTransactionType, nextSort, nextFilters)
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }

  function changeTransaction(next: ApartmentTransactionType) {
    navigate(next, sort, filters)
  }

  function submitFilters() {
    const validation = validateApartmentFeedForm(draft)
    if (validation) {
      setFormError(validation)
      return
    }
    setFormError(null)
    navigate(transactionType, sort, filtersFromApartmentForm(transactionType, draft))
  }

  function clearFilters() {
    setDraft({ ...emptyApartmentFeedForm })
    setFormError(null)
    router.replace(pathname, { scroll: false })
  }

  function changeSort(nextSort: PublicApartmentListingSort) {
    navigate(transactionType, nextSort, filters)
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await listPublicApartmentListings({
        limit,
        cursor: nextCursor,
        sort,
        filters,
      })
      setItems((current) => {
        const known = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !known.has(item.id))]
      })
      setNextCursor(page.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof ApiClientError
        ? loadError.message
        : 'Daha fazla ilan yüklenemedi.')
    } finally {
      setLoadingMore(false)
    }
  }

  const activeCount = activeApartmentFilterCount(filters)

  return (
    <div className="apartment-feed">
      <div className="apartment-feed-shell">
        <div className="apartment-type-switch" role="group" aria-label="İşlem türü">
          <button
            type="button"
            className={transactionType === 'sale' ? 'is-active' : undefined}
            onClick={() => changeTransaction('sale')}
          >
            Satılık
          </button>
          <button
            type="button"
            className={transactionType === 'rent' ? 'is-active' : undefined}
            onClick={() => changeTransaction('rent')}
          >
            Kiralık
          </button>
        </div>

        <form
          className="apartment-filter-panel"
          onSubmit={(event) => {
            event.preventDefault()
            submitFilters()
          }}
        >
          <div className="apartment-filter-row">
            <label>
              <span>Kelime</span>
              <input
                type="search"
                value={draft.q}
                maxLength={80}
                placeholder="Başlık veya açıklama"
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              />
            </label>
            <label>
              <span>İl</span>
              <select
                value={draft.provinceId}
                onChange={(event) => setDraft({
                  ...draft,
                  provinceId: event.target.value,
                  districtId: '',
                })}
              >
                <option value="">Tüm Türkiye</option>
                {provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>İlçe</span>
              <select
                value={draft.districtId}
                disabled={!draft.provinceId}
                onChange={(event) => setDraft({ ...draft, districtId: event.target.value })}
              >
                <option value="">Tüm ilçeler</option>
                {districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Oda sayısı</span>
              <select
                value={draft.roomCount}
                onChange={(event) => setDraft({ ...draft, roomCount: event.target.value })}
              >
                <option value="">Tümü</option>
                {roomCounts.map((room) => <option key={room} value={room}>{room}</option>)}
              </select>
            </label>
          </div>

          <div className="apartment-filter-row">
            <label>
              <span>Min fiyat</span>
              <input
                type="number"
                min={1}
                value={draft.minPrice}
                onChange={(event) => setDraft({ ...draft, minPrice: event.target.value })}
              />
            </label>
            <label>
              <span>Max fiyat</span>
              <input
                type="number"
                min={1}
                value={draft.maxPrice}
                onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })}
              />
            </label>
            <label>
              <span>Min m²</span>
              <input
                type="number"
                min={1}
                value={draft.minGrossM2}
                onChange={(event) => setDraft({ ...draft, minGrossM2: event.target.value })}
              />
            </label>
            <label>
              <span>Max m²</span>
              <input
                type="number"
                min={1}
                value={draft.maxGrossM2}
                onChange={(event) => setDraft({ ...draft, maxGrossM2: event.target.value })}
              />
            </label>
          </div>

          <div className="apartment-filter-row">
            <label>
              <span>Max bina yaşı</span>
              <input
                type="number"
                min={0}
                max={200}
                value={draft.maxBuildingAge}
                onChange={(event) => setDraft({ ...draft, maxBuildingAge: event.target.value })}
              />
            </label>
            <label>
              <span>Isıtma</span>
              <select
                value={draft.heating}
                onChange={(event) => setDraft({ ...draft, heating: event.target.value })}
              >
                <option value="">Tümü</option>
                {Object.entries(heatingLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Otopark</span>
              <select
                value={draft.parking}
                onChange={(event) => setDraft({ ...draft, parking: event.target.value })}
              >
                <option value="">Tümü</option>
                {Object.entries(parkingLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Eşyalı</span>
              <select
                value={draft.furnished}
                onChange={(event) => setDraft({ ...draft, furnished: event.target.value })}
              >
                <option value="">Tümü</option>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            </label>
            <label>
              <span>Site içinde</span>
              <select
                value={draft.inSite}
                onChange={(event) => setDraft({ ...draft, inSite: event.target.value })}
              >
                <option value="">Tümü</option>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            </label>
          </div>

          {formError && <p className="field-error" role="alert">{formError}</p>}

          <div className="apartment-filter-actions">
            <button type="submit">Filtrele</button>
            {activeCount > 0 && (
              <button type="button" className="apartment-filter-clear" onClick={clearFilters}>
                Temizle
              </button>
            )}
            <span>{activeCount > 0 ? `${activeCount} filtre aktif` : 'Tüm daireler'}</span>
          </div>
        </form>
      </div>

      <div className="apartment-results">
        <div className="car-feed-toolbar">
          <div>
            <strong>{loading ? 'Daireler yükleniyor' : `${items.length} ilan gösteriliyor`}</strong>
            <span>{transactionType === 'sale' ? 'Satılık daireler' : 'Kiralık daireler'}</span>
          </div>
          <label>
            <span>Sırala</span>
            <select
              value={sort}
              onChange={(event) => changeSort(event.target.value as PublicApartmentListingSort)}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="public-listing-grid" aria-label="Daireler yükleniyor">
            {Array.from({ length: Math.min(limit, 6) }, (_, index) => (
              <div className="listing-card listing-card-skeleton" key={index} aria-hidden="true">
                <div className="listing-card-media" />
                <div className="listing-card-body"><span /><span /><span /></div>
              </div>
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div className="public-list-state public-list-error" role="alert">
            <strong>Daire ilanları yüklenemedi.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
              Tekrar dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="public-list-state">
            <strong>Bu filtrelerle daire bulunamadı.</strong>
            <span>Filtreleri temizleyip tekrar deneyebilirsin.</span>
            <button type="button" onClick={clearFilters}>Filtreleri temizle</button>
          </div>
        ) : (
          <>
            <div className="public-listing-grid">
              {items.map((item) => <PublicApartmentCard item={item} key={item.id} />)}
            </div>
            {error && (
              <div className="public-list-state public-list-error" role="alert">
                <span>{error}</span>
              </div>
            )}
            {nextCursor && (
              <div className="public-list-actions">
                <button type="button" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
