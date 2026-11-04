import type { FormEvent } from 'react'
import type { CarFeedFormValues } from './car-feed-query'

export interface FilterOption {
  id: string
  name: string
}

interface CarFeedFiltersViewProps {
  values: CarFeedFormValues
  brands: FilterOption[]
  series: FilterOption[]
  models: FilterOption[]
  provinces: FilterOption[]
  districts: FilterOption[]
  loadingSeries: boolean
  loadingModels: boolean
  loadingDistricts: boolean
  activeCount: number
  error: string | null
  onChange: (field: keyof CarFeedFormValues, value: string) => void
  onSubmit: () => void
  onClear: () => void
}

function SelectOptions({ items }: { items: FilterOption[] }) {
  return items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)
}

export function CarFeedFiltersView({
  values,
  brands,
  series,
  models,
  provinces,
  districts,
  loadingSeries,
  loadingModels,
  loadingDistricts,
  activeCount,
  error,
  onChange,
  onSubmit,
  onClear,
}: CarFeedFiltersViewProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <aside className="car-feed-filters">
      <form onSubmit={handleSubmit}>
        <div className="car-feed-filter-heading">
          <strong>Filtreler</strong>
          {activeCount > 0 && <span>{activeCount} aktif</span>}
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}

        <label>
          <span>Kelime</span>
          <input
            type="search"
            value={values.q}
            maxLength={80}
            placeholder="Başlık veya açıklama"
            onChange={(event) => onChange('q', event.target.value)}
          />
        </label>

        <div className="car-feed-filter-group">
          <span className="car-feed-filter-group-title">Araç</span>
          <label>
            <span>Marka</span>
            <select value={values.brandId} onChange={(event) => onChange('brandId', event.target.value)}>
              <option value="">Tüm markalar</option>
              <SelectOptions items={brands} />
            </select>
          </label>
          <label>
            <span>Seri</span>
            <select
              value={values.seriesId}
              disabled={!values.brandId || loadingSeries}
              onChange={(event) => onChange('seriesId', event.target.value)}
            >
              <option value="">{loadingSeries ? 'Yükleniyor…' : 'Tüm seriler'}</option>
              <SelectOptions items={series} />
            </select>
          </label>
          <label>
            <span>Model</span>
            <select
              value={values.modelId}
              disabled={!values.seriesId || loadingModels}
              onChange={(event) => onChange('modelId', event.target.value)}
            >
              <option value="">{loadingModels ? 'Yükleniyor…' : 'Tüm modeller'}</option>
              <SelectOptions items={models} />
            </select>
          </label>
        </div>

        <div className="car-feed-filter-group">
          <span className="car-feed-filter-group-title">Konum</span>
          <label>
            <span>İl</span>
            <select
              value={values.provinceId}
              onChange={(event) => onChange('provinceId', event.target.value)}
            >
              <option value="">Tüm Türkiye</option>
              <SelectOptions items={provinces} />
            </select>
          </label>
          <label>
            <span>İlçe</span>
            <select
              value={values.districtId}
              disabled={!values.provinceId || loadingDistricts}
              onChange={(event) => onChange('districtId', event.target.value)}
            >
              <option value="">{loadingDistricts ? 'Yükleniyor…' : 'Tüm ilçeler'}</option>
              <SelectOptions items={districts} />
            </select>
          </label>
        </div>

        <div className="car-feed-filter-group">
          <span className="car-feed-filter-group-title">Fiyat ve yıl</span>
          <div className="car-feed-range">
            <label>
              <span>Min fiyat</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.minPrice}
                placeholder="TL"
                onChange={(event) => onChange('minPrice', event.target.value)}
              />
            </label>
            <label>
              <span>Max fiyat</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={values.maxPrice}
                placeholder="TL"
                onChange={(event) => onChange('maxPrice', event.target.value)}
              />
            </label>
          </div>
          <div className="car-feed-range">
            <label>
              <span>Min yıl</span>
              <input
                type="number"
                min={1950}
                max={2100}
                value={values.minYear}
                placeholder="Örn. 2018"
                onChange={(event) => onChange('minYear', event.target.value)}
              />
            </label>
            <label>
              <span>Max yıl</span>
              <input
                type="number"
                min={1950}
                max={2100}
                value={values.maxYear}
                placeholder="Örn. 2024"
                onChange={(event) => onChange('maxYear', event.target.value)}
              />
            </label>
          </div>
          <div className="car-feed-range">
            <label>
              <span>Min KM</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={values.minMileageKm}
                placeholder="0"
                onChange={(event) => onChange('minMileageKm', event.target.value)}
              />
            </label>
            <label>
              <span>Max KM</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={values.maxMileageKm}
                placeholder="Örn. 100000"
                onChange={(event) => onChange('maxMileageKm', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="car-feed-filter-group">
          <span className="car-feed-filter-group-title">Araç özellikleri</span>
          <label>
            <span>Yakıt</span>
            <select value={values.fuelType} onChange={(event) => onChange('fuelType', event.target.value)}>
              <option value="">Tümü</option>
              <option value="benzin">Benzin</option>
              <option value="dizel">Dizel</option>
              <option value="lpg">LPG</option>
              <option value="hibrit">Hibrit</option>
              <option value="elektrik">Elektrik</option>
            </select>
          </label>
          <label>
            <span>Vites</span>
            <select
              value={values.transmission}
              onChange={(event) => onChange('transmission', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="manuel">Manuel</option>
              <option value="otomatik">Otomatik</option>
              <option value="yari_otomatik">Yarı otomatik</option>
            </select>
          </label>
          <label>
            <span>Kasa tipi</span>
            <select
              value={values.bodyType}
              onChange={(event) => onChange('bodyType', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="hatchback">Hatchback</option>
              <option value="sedan">Sedan</option>
              <option value="station_wagon">Station wagon</option>
              <option value="suv">SUV</option>
              <option value="coupe">Coupe</option>
              <option value="cabrio">Cabrio</option>
              <option value="mpv">MPV</option>
              <option value="roadster">Roadster</option>
              <option value="diger">Diğer</option>
            </select>
          </label>
          <label>
            <span>Çekiş</span>
            <select
              value={values.drivetrain}
              onChange={(event) => onChange('drivetrain', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="front">Önden çekiş</option>
              <option value="rear">Arkadan itiş</option>
              <option value="four_wd">4WD</option>
              <option value="awd">AWD</option>
            </select>
          </label>
          <label>
            <span>Araç durumu</span>
            <select
              value={values.vehicleCondition}
              onChange={(event) => onChange('vehicleCondition', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="second_hand">İkinci el</option>
              <option value="imported_new">Yurtdışından ithal sıfır</option>
              <option value="new">Sıfır</option>
            </select>
          </label>
          <label>
            <span>Renk</span>
            <input
              type="text"
              maxLength={40}
              value={values.color}
              placeholder="Örn. Beyaz"
              onChange={(event) => onChange('color', event.target.value)}
            />
          </label>
        </div>

        <div className="car-feed-filter-group">
          <span className="car-feed-filter-group-title">Diğer</span>
          <label>
            <span>Takas</span>
            <select
              value={values.swapAvailable}
              onChange={(event) => onChange('swapAvailable', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="true">Takaslı</option>
              <option value="false">Takassız</option>
            </select>
          </label>
          <label>
            <span>İlan tarihi</span>
            <select
              value={values.listedWithinDays}
              onChange={(event) => onChange('listedWithinDays', event.target.value)}
            >
              <option value="">Tümü</option>
              <option value="1">Son 24 saat</option>
              <option value="3">Son 3 gün</option>
              <option value="7">Son 7 gün</option>
              <option value="15">Son 15 gün</option>
              <option value="30">Son 30 gün</option>
            </select>
          </label>
        </div>

        <div className="car-feed-filter-actions">
          <button type="submit">Filtrele</button>
          {activeCount > 0 && (
            <button className="car-feed-filter-clear" type="button" onClick={onClear}>
              Temizle
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}
