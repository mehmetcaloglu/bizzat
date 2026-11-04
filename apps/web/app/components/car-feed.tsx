'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ApiClientError,
  listDistricts,
  listProvinces,
  listPublicCarListings,
  listVehicleBrands,
  listVehicleModels,
  listVehicleSeries,
  type PublicCarListingItem,
  type PublicCarListingSort,
} from '../../lib/api-client'
import { CarFeedFiltersView, type FilterOption } from './car-feed-filters-view'
import {
  activeFilterCount,
  emptyCarFeedForm,
  filtersFromForm,
  formFromFilters,
  parseCarFeedQuery,
  toCarFeedSearchParams,
  validateCarFeedForm,
  type CarFeedFormValues,
} from './car-feed-query'
import { PublicCarListingCard } from './public-car-listings'

const sortOptions: Array<{ value: PublicCarListingSort; label: string }> = [
  { value: 'newest', label: 'En yeni' },
  { value: 'oldest', label: 'En eski' },
  { value: 'price_asc', label: 'Fiyat artan' },
  { value: 'price_desc', label: 'Fiyat azalan' },
  { value: 'mileage_asc', label: 'KM artan' },
  { value: 'mileage_desc', label: 'KM azalan' },
  { value: 'year_desc', label: 'Yıl yeni' },
  { value: 'year_asc', label: 'Yıl eski' },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

interface CarFeedProps {
  limit?: number
}

export function CarFeed({ limit = 12 }: CarFeedProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const { sort, filters } = parseCarFeedQuery(new URLSearchParams(queryString))
  const filtersKey = JSON.stringify(filters)
  const lastFiltersKey = useRef(filtersKey)

  const [draft, setDraft] = useState<CarFeedFormValues>(() => formFromFilters(filters))
  const [brands, setBrands] = useState<FilterOption[]>([])
  const [series, setSeries] = useState<FilterOption[]>([])
  const [models, setModels] = useState<FilterOption[]>([])
  const [provinces, setProvinces] = useState<FilterOption[]>([])
  const [districts, setDistricts] = useState<FilterOption[]>([])
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [items, setItems] = useState<PublicCarListingItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    if (lastFiltersKey.current === filtersKey) return
    lastFiltersKey.current = filtersKey
    setDraft(formFromFilters(parseCarFeedQuery(new URLSearchParams(queryString)).filters))
  }, [filtersKey, queryString])

  useEffect(() => {
    let cancelled = false
    void Promise.all([listVehicleBrands(), listProvinces()])
      .then(([brandItems, provinceItems]) => {
        if (cancelled) return
        setBrands(brandItems)
        setProvinces(provinceItems)
      })
      .catch(() => {
        if (!cancelled) setFilterError('Filtre seçenekleri yüklenemedi. Tekrar deneyebilirsin.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (draft.brandId === '') {
      setSeries([])
      return
    }
    let cancelled = false
    setLoadingSeries(true)
    void listVehicleSeries(draft.brandId)
      .then((items) => {
        if (!cancelled) setSeries(items)
      })
      .catch(() => {
        if (!cancelled) setFilterError('Seri seçenekleri yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSeries(false)
      })
    return () => {
      cancelled = true
    }
  }, [draft.brandId])

  useEffect(() => {
    if (draft.seriesId === '') {
      setModels([])
      return
    }
    let cancelled = false
    setLoadingModels(true)
    void listVehicleModels(draft.seriesId)
      .then((items) => {
        if (!cancelled) setModels(items)
      })
      .catch(() => {
        if (!cancelled) setFilterError('Model seçenekleri yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false)
      })
    return () => {
      cancelled = true
    }
  }, [draft.seriesId])

  useEffect(() => {
    if (draft.provinceId === '') {
      setDistricts([])
      return
    }
    let cancelled = false
    setLoadingDistricts(true)
    void listDistricts(draft.provinceId)
      .then((items) => {
        if (!cancelled) setDistricts(items)
      })
      .catch(() => {
        if (!cancelled) setFilterError('İlçe seçenekleri yüklenemedi.')
      })
      .finally(() => {
        if (!cancelled) setLoadingDistricts(false)
      })
    return () => {
      cancelled = true
    }
  }, [draft.provinceId])

  useEffect(() => {
    let cancelled = false
    const query = parseCarFeedQuery(new URLSearchParams(queryString))
    setLoading(true)
    setError(null)
    setNextCursor(null)

    void listPublicCarListings({
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
        setError(errorMessage(loadError, 'İlanlar şu anda yüklenemiyor.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [limit, queryString, retryVersion])

  function navigate(nextSort: PublicCarListingSort, nextFilters: ReturnType<typeof filtersFromForm>) {
    const params = toCarFeedSearchParams(nextSort, nextFilters)
    const suffix = params.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }

  function handleChange(field: keyof CarFeedFormValues, value: string) {
    setFilterError(null)
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'brandId') {
        next.seriesId = ''
        next.modelId = ''
      }
      if (field === 'seriesId') next.modelId = ''
      if (field === 'provinceId') next.districtId = ''
      return next
    })
  }

  function handleSubmit() {
    const validationError = validateCarFeedForm(draft)
    if (validationError) {
      setFilterError(validationError)
      return
    }
    setFilterError(null)
    navigate(sort, filtersFromForm(draft))
  }

  function handleClear() {
    setDraft({ ...emptyCarFeedForm })
    setFilterError(null)
    router.replace(pathname, { scroll: false })
  }

  function handleSortChange(nextSort: PublicCarListingSort) {
    navigate(nextSort, filters)
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await listPublicCarListings({
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
      setError(errorMessage(loadError, 'Daha fazla ilan yüklenemedi.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const activeCount = activeFilterCount(filters)

  return (
    <div className="car-feed-layout">
      <CarFeedFiltersView
        values={draft}
        brands={brands}
        series={series}
        models={models}
        provinces={provinces}
        districts={districts}
        loadingSeries={loadingSeries}
        loadingModels={loadingModels}
        loadingDistricts={loadingDistricts}
        activeCount={activeCount}
        error={filterError}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <section className="car-feed-results">
        <div className="car-feed-toolbar">
          <div>
            <strong>{loading ? 'İlanlar yükleniyor' : `${items.length} ilan gösteriliyor`}</strong>
            <span>Aradığın aracı filtreleyerek daralt.</span>
          </div>
          <label>
            <span>Sırala</span>
            <select
              value={sort}
              onChange={(event) => handleSortChange(event.target.value as PublicCarListingSort)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="public-listing-grid" aria-label="İlanlar yükleniyor">
            {Array.from({ length: Math.min(limit, 6) }, (_, index) => (
              <div className="listing-card listing-card-skeleton" key={index} aria-hidden="true">
                <div className="listing-card-media" />
                <div className="listing-card-body">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div className="public-list-state public-list-error" role="alert">
            <strong>İlanlar yüklenemedi.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
              Tekrar dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="public-list-state">
            <strong>{activeCount > 0 ? 'Bu filtrelerle ilan bulunamadı.' : 'Henüz yayında otomobil ilanı yok.'}</strong>
            <span>
              {activeCount > 0
                ? 'Filtreleri temizleyip tekrar deneyebilirsin.'
                : 'İlk ilanlardan birini sen oluşturabilirsin.'}
            </span>
            {activeCount > 0
              ? <button type="button" onClick={handleClear}>Filtreleri temizle</button>
              : <Link href="/ilan-ver/otomobil">İlan ver</Link>}
          </div>
        ) : (
          <>
            <div className="public-listing-grid">
              {items.map((item) => <PublicCarListingCard item={item} key={item.id} />)}
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
      </section>
    </div>
  )
}
