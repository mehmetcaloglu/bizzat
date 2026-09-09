import type { Kysely } from 'kysely'
import type { Database } from '../../db/client.js'
import { validateVehicleCatalog } from './catalog-validator.js'

export interface VehicleCatalogImportResult {
  counts: {
    brands: number
    series: number
    models: number
  }
}

export async function importVehicleCatalog(
  db: Kysely<Database>,
  value: unknown,
): Promise<VehicleCatalogImportResult> {
  validateVehicleCatalog(value)
  const now = new Date()

  return db.transaction().execute(async (trx) => {
    const brandIds = new Map<string, string>()
    for (const brand of value.brands) {
      const key = brand.key.trim()
      const row = await trx
        .insertInto('vehicle_brands')
        .values({
          catalog_key: key,
          name: brand.name.trim(),
          active: true,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('catalog_key').doUpdateSet({
          name: brand.name.trim(),
          active: true,
          updated_at: now,
        }))
        .returning(['id', 'catalog_key'])
        .executeTakeFirstOrThrow()
      brandIds.set(row.catalog_key, row.id)
    }

    const seriesIds = new Map<string, string>()
    for (const series of value.series) {
      const key = series.key.trim()
      const brandId = brandIds.get(series.brandKey.trim())
      if (!brandId) {
        throw new Error(`Missing validated vehicle brand: ${series.brandKey}`)
      }

      const existing = await trx
        .selectFrom('vehicle_series')
        .select('brand_id')
        .where('catalog_key', '=', key)
        .executeTakeFirst()
      if (existing && existing.brand_id !== brandId) {
        throw new Error(`Cannot reparent vehicle series ${key}`)
      }

      const row = await trx
        .insertInto('vehicle_series')
        .values({
          brand_id: brandId,
          catalog_key: key,
          name: series.name.trim(),
          active: true,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('catalog_key').doUpdateSet({
          name: series.name.trim(),
          active: true,
          updated_at: now,
        }))
        .returning(['id', 'catalog_key', 'brand_id'])
        .executeTakeFirstOrThrow()
      if (row.brand_id !== brandId) {
        throw new Error(`Cannot reparent vehicle series ${key}`)
      }
      seriesIds.set(row.catalog_key, row.id)
    }

    for (const model of value.models) {
      const seriesId = seriesIds.get(model.seriesKey.trim())
      if (!seriesId) {
        throw new Error(`Missing validated vehicle series: ${model.seriesKey}`)
      }

      const modelKey = model.key.trim()
      const existing = await trx
        .selectFrom('vehicle_models')
        .select('series_id')
        .where('catalog_key', '=', modelKey)
        .executeTakeFirst()
      if (existing && existing.series_id !== seriesId) {
        throw new Error(`Cannot reparent vehicle model ${modelKey}`)
      }

      const row = await trx
        .insertInto('vehicle_models')
        .values({
          series_id: seriesId,
          catalog_key: modelKey,
          name: model.name.trim(),
          selection_path: model.selectionPath
            ? JSON.stringify(model.selectionPath.map((node) => ({
                key: node.key.trim(),
                name: node.name.trim(),
              })))
            : null,
          active: true,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('catalog_key').doUpdateSet({
          name: model.name.trim(),
          selection_path: model.selectionPath
            ? JSON.stringify(model.selectionPath.map((node) => ({
                key: node.key.trim(),
                name: node.name.trim(),
              })))
            : null,
          active: true,
          updated_at: now,
        }))
        .returning('series_id')
        .executeTakeFirstOrThrow()
      if (row.series_id !== seriesId) {
        throw new Error(`Cannot reparent vehicle model ${modelKey}`)
      }
    }

    const modelKeys = value.models.map((item) => item.key.trim())
    const seriesKeys = value.series.map((item) => item.key.trim())
    const brandKeys = value.brands.map((item) => item.key.trim())

    if (modelKeys.length === 0) {
      await trx.updateTable('vehicle_models').set({ active: false, updated_at: now }).execute()
    } else {
      await trx.updateTable('vehicle_models')
        .set({ active: false, updated_at: now })
        .where('catalog_key', 'not in', modelKeys)
        .execute()
    }

    if (seriesKeys.length === 0) {
      await trx.updateTable('vehicle_series').set({ active: false, updated_at: now }).execute()
    } else {
      await trx.updateTable('vehicle_series')
        .set({ active: false, updated_at: now })
        .where('catalog_key', 'not in', seriesKeys)
        .execute()
    }

    if (brandKeys.length === 0) {
      await trx.updateTable('vehicle_brands').set({ active: false, updated_at: now }).execute()
    } else {
      await trx.updateTable('vehicle_brands')
        .set({ active: false, updated_at: now })
        .where('catalog_key', 'not in', brandKeys)
        .execute()
    }

    return {
      counts: {
        brands: value.brands.length,
        series: value.series.length,
        models: value.models.length,
      },
    }
  })
}
