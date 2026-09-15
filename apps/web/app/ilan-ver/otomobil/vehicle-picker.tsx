'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ApiClientError,
  createCarSaleDraft,
  getMe,
  listVehicleBrands,
  listVehicleSelection,
  listVehicleSeries,
  type CarSaleDraftResponse,
} from '../../../lib/api-client'
import {
  clearSelectedModel,
  getPickerInteractionState,
  initialVehiclePickerState,
  removeUnavailableModelFromLevels,
  selectBrand,
  selectGroup,
  selectModel,
  selectSeries,
  type VehiclePickerState,
  type VehicleReferenceItem,
  type VehicleSelectionGroup,
  type VehicleSelectionItem,
  type VehicleSelectionModel,
} from './vehicle-picker-state'

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'error'

type LoadingTarget = 'boot' | 'series' | 'selection' | 'draft' | null

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'Bir şey ters gitti. Tekrar deneyebilirsin.'
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401
}

function isStaleReference(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}

function breadcrumb(state: VehiclePickerState): string[] {
  return [
    state.brand?.name,
    state.series?.name,
    ...state.path.map((item) => item.name),
  ].filter((value): value is string => Boolean(value))
}

export function VehiclePicker() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [picker, setPicker] = useState<VehiclePickerState>(initialVehiclePickerState)
  const [brands, setBrands] = useState<VehicleReferenceItem[]>([])
  const [series, setSeries] = useState<VehicleReferenceItem[]>([])
  const [levels, setLevels] = useState<VehicleSelectionItem[][]>([])
  const [loadingTarget, setLoadingTarget] = useState<LoadingTarget>('boot')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<CarSaleDraftResponse['listing'] | null>(null)
  const requestVersion = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setLoadingTarget('boot')
      try {
        await getMe()
        if (cancelled) return
        setAuthState('authenticated')
        const items = await listVehicleBrands()
        if (cancelled) return
        setBrands(items)
      } catch (bootError) {
        if (cancelled) return
        if (isUnauthorized(bootError)) {
          setAuthState('unauthenticated')
        } else {
          setAuthState('error')
          setError(errorMessage(bootError))
        }
      } finally {
        if (!cancelled) setLoadingTarget(null)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  function resetResult() {
    setDraft(null)
    setError(null)
  }

  async function handleBrand(brand: VehicleReferenceItem) {
    const version = ++requestVersion.current
    resetResult()
    setPicker((current) => selectBrand(current, brand))
    setSeries([])
    setLevels([])
    setLoadingTarget('series')

    try {
      const items = await listVehicleSeries(brand.id)
      if (requestVersion.current !== version) return
      setSeries(items)
    } catch (loadError) {
      if (requestVersion.current !== version) return
      setError(isStaleReference(loadError)
        ? 'Bu marka artık kullanılamıyor. Başka bir marka seç.'
        : errorMessage(loadError))
    } finally {
      if (requestVersion.current === version) setLoadingTarget(null)
    }
  }

  async function handleSeries(selectedSeries: VehicleReferenceItem) {
    const version = ++requestVersion.current
    resetResult()
    setPicker((current) => selectSeries(current, selectedSeries))
    setLevels([])
    setLoadingTarget('selection')

    try {
      const items = await listVehicleSelection(selectedSeries.id)
      if (requestVersion.current !== version) return
      setLevels([items])
    } catch (loadError) {
      if (requestVersion.current !== version) return
      setError(isStaleReference(loadError)
        ? 'Bu seri güncellendi. Seriyi yeniden seç.'
        : errorMessage(loadError))
    } finally {
      if (requestVersion.current === version) setLoadingTarget(null)
    }
  }

  async function handleGroup(depth: number, group: VehicleSelectionGroup) {
    if (!picker.series) return

    const version = ++requestVersion.current
    resetResult()
    setPicker((current) => selectGroup(current, depth, group))
    setLevels((current) => current.slice(0, depth + 1))
    setLoadingTarget('selection')

    try {
      const items = await listVehicleSelection(picker.series.id, group.key)
      if (requestVersion.current !== version) return
      setLevels((current) => [...current.slice(0, depth + 1), items])
    } catch (loadError) {
      if (requestVersion.current !== version) return
      setError(isStaleReference(loadError)
        ? 'Bu seçenek güncellendi. Bu seviyeden yeniden seçim yap.'
        : errorMessage(loadError))
    } finally {
      if (requestVersion.current === version) setLoadingTarget(null)
    }
  }

  function handleModel(depth: number, model: VehicleSelectionModel) {
    ++requestVersion.current
    resetResult()
    setPicker((current) => selectModel(current, depth, model))
    setLevels((current) => current.slice(0, depth + 1))
    setLoadingTarget(null)
  }

  async function handleCreateDraft() {
    const vehicleModelId = picker.vehicleModelId
    if (!vehicleModelId || loadingTarget === 'draft' || draft) return

    setError(null)
    setLoadingTarget('draft')
    try {
      const response = await createCarSaleDraft(vehicleModelId)
      setDraft(response.listing)
    } catch (createError) {
      if (isUnauthorized(createError)) {
        setAuthState('unauthenticated')
        setError('Oturumun sona erdi. Devam etmek için yeniden giriş yap.')
      } else if (
        createError instanceof ApiClientError
        && createError.code === 'VEHICLE_MODEL_NOT_AVAILABLE'
      ) {
        setPicker((current) => clearSelectedModel(current))
        setLevels((current) => removeUnavailableModelFromLevels(current, vehicleModelId))
        setError('Bu araç seçeneği artık kullanılamıyor. Araç detayını yeniden seç.')
      } else {
        setError(errorMessage(createError))
      }
    } finally {
      setLoadingTarget(null)
    }
  }

  const path = breadcrumb(picker)
  const interaction = getPickerInteractionState({
    authenticated: authState === 'authenticated',
    vehicleModelId: picker.vehicleModelId,
    isCreatingDraft: loadingTarget === 'draft',
    hasCreatedDraft: draft !== null,
  })

  return (
    <main className="listing-create-shell">
      <header className="listing-create-header">
        <a className="wordmark listing-wordmark" href="/">bizzat</a>
        <span className="listing-create-kicker">İlan ver · Otomobil</span>
      </header>

      <section className="listing-create-intro" aria-labelledby="car-listing-title">
        <div>
          <p className="listing-create-eyebrow">Satılık otomobil</p>
          <h1 id="car-listing-title">Satılık otomobil ilanı</h1>
          <p className="listing-create-lead">
            Önce aracını seç. İlanın diğer bilgilerini sonraki adımlarda tamamlayacağız.
          </p>
        </div>
        <div className="selection-trail" aria-label="Seçim yolu">
          <span>Seçim yolu</span>
          <strong>{path.length > 0 ? path.join(' / ') : 'Henüz araç seçmedin'}</strong>
        </div>
      </section>

      {authState === 'unauthenticated' && (
        <div className="listing-notice" role="status">
          <div>
            <strong>İlan vermek için giriş yap.</strong>
            <span>Giriş yaptıktan sonra araç seçimine devam edebilirsin.</span>
          </div>
          <a className="listing-link-button" href="/login">Giriş yap</a>
        </div>
      )}

      {authState === 'error' && (
        <div className="listing-error" role="alert">{error}</div>
      )}

      <section className="vehicle-picker" aria-label="Araç seçimi">
        <div className="picker-column">
          <div className="picker-heading">
            <span className="picker-step">1</span>
            <div>
              <h2>Marka</h2>
              <p>Otomobil markasını seç.</p>
            </div>
          </div>
          <div className="picker-options" aria-busy={loadingTarget === 'boot'}>
            {brands.map((brand) => (
              <button
                className="picker-option"
                data-selected={picker.brand?.id === brand.id}
                key={brand.id}
                type="button"
                disabled={interaction.selectionDisabled}
                onClick={() => void handleBrand(brand)}
              >
                <span>{brand.name}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
            {authState === 'checking' && <p className="picker-empty">Oturum kontrol ediliyor…</p>}
            {authState === 'authenticated' && loadingTarget === 'boot' && (
              <p className="picker-empty">Markalar yükleniyor…</p>
            )}
          </div>
        </div>

        <div className="picker-column">
          <div className="picker-heading">
            <span className="picker-step">2</span>
            <div>
              <h2>Seri</h2>
              <p>Seçtiğin markanın serisini seç.</p>
            </div>
          </div>
          <div className="picker-options" aria-busy={loadingTarget === 'series'}>
            {series.map((item) => (
              <button
                className="picker-option"
                data-selected={picker.series?.id === item.id}
                key={item.id}
                type="button"
                disabled={interaction.selectionDisabled}
                onClick={() => void handleSeries(item)}
              >
                <span>{item.name}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
            {!picker.brand && <p className="picker-empty">Önce marka seç.</p>}
            {picker.brand && loadingTarget === 'series' && (
              <p className="picker-empty">Seriler yükleniyor…</p>
            )}
            {picker.brand && loadingTarget !== 'series' && series.length === 0 && (
              <p className="picker-empty">Bu marka için aktif seri bulunamadı.</p>
            )}
          </div>
        </div>

        <div className="picker-column picker-detail-column">
          <div className="picker-heading">
            <span className="picker-step">3</span>
            <div>
              <h2>Araç detayını seç</h2>
              <p>Motor, gövde veya paket dalları araca göre değişebilir.</p>
            </div>
          </div>

          <div className="selection-levels">
            {!picker.series && <p className="picker-empty">Önce seri seç.</p>}
            {levels.map((items, depth) => (
              <div className="selection-level" key={`level-${depth}`}>
                <span className="selection-level-label">Seçim {depth + 1}</span>
                <div className="picker-options detail-options">
                  {items.map((item) => {
                    const selected = picker.path[depth]?.key === item.key
                    return (
                      <button
                        className="picker-option"
                        data-selected={selected}
                        key={item.key}
                        type="button"
                        disabled={interaction.selectionDisabled}
                        onClick={() => item.kind === 'group'
                          ? void handleGroup(depth, item)
                          : handleModel(depth, item)}
                      >
                        <span>{item.name}</span>
                        <span aria-hidden="true">{item.kind === 'group' ? '›' : '✓'}</span>
                      </button>
                    )
                  })}
                  {items.length === 0 && (
                    <p className="picker-empty">Bu seviyede seçilebilir seçenek kalmadı.</p>
                  )}
                </div>
              </div>
            ))}
            {picker.series && loadingTarget === 'selection' && (
              <p className="picker-empty">Seçenekler yükleniyor…</p>
            )}
          </div>
        </div>
      </section>

      {error && authState !== 'error' && (
        <div className="listing-error" role="alert">{error}</div>
      )}

      <section className="listing-create-footer">
        <div>
          <span className="footer-label">Seçilen araç</span>
          <strong>{path.length >= 2 ? path.join(' / ') : 'Araç seçimi tamamlanmadı'}</strong>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!interaction.canCreateDraft}
          onClick={() => void handleCreateDraft()}
        >
          {draft
            ? 'Taslak oluşturuldu'
            : loadingTarget === 'draft'
              ? 'Taslak oluşturuluyor…'
              : 'İlan taslağını oluştur'}
        </button>
      </section>

      {draft && (
        <section className="draft-success" role="status">
          <span className="draft-success-mark" aria-hidden="true">✓</span>
          <div>
            <strong>İlan taslağın hazır.</strong>
            <p>{[
              draft.vehicle.brand.name,
              draft.vehicle.series.name,
              ...draft.vehicle.selectionPath.map((node) => node.name),
            ].join(' / ')}</p>
            <small>Taslak no: {draft.id}</small>
          </div>
        </section>
      )}
    </main>
  )
}
