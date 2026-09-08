import { createHash } from 'node:crypto'
import type { NormalizedLocationSnapshot } from './location-import.types.js'

export function checksumLocationSnapshot(snapshot: NormalizedLocationSnapshot): string {
  const canonical = {
    provider: {
      code: snapshot.provider.code.trim(),
      sourceName: snapshot.provider.sourceName.trim(),
      sourceUrl: snapshot.provider.sourceUrl?.trim() ?? null,
      license: snapshot.provider.license?.trim() ?? null,
      version: snapshot.provider.version.trim(),
    },
    provinces: snapshot.provinces
      .map((item) => ({ sourceKey: item.sourceKey.trim(), code: item.code.trim(), name: item.name.trim() }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    districts: snapshot.districts
      .map((item) => ({ sourceKey: item.sourceKey.trim(), provinceSourceKey: item.provinceSourceKey.trim(), name: item.name.trim() }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    neighborhoods: snapshot.neighborhoods
      .map((item) => ({
        sourceKey: item.sourceKey.trim(),
        districtSourceKey: item.districtSourceKey.trim(),
        name: item.name.trim(),
        kind: item.kind?.trim() ?? null,
      }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
