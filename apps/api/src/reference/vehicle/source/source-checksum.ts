import { createHash } from 'node:crypto'
import { normalizeVehicleSourceIdentity } from './source-normalization.js'
import type { NormalizedVehicleSourceSnapshot } from './source.types.js'

export function checksumVehicleSourceSnapshot(
  snapshot: NormalizedVehicleSourceSnapshot,
): string {
  const logical = {
    provider: {
      code: snapshot.provider.code,
      sourceName: snapshot.provider.sourceName,
      sourceUrl: snapshot.provider.sourceUrl ?? null,
      version: snapshot.provider.version,
    },
    records: snapshot.records
      .map((record) => ({
        sourceKey: record.sourceKey,
        brandRaw: normalizeVehicleSourceIdentity(record.brandRaw),
        typeRaw: normalizeVehicleSourceIdentity(record.typeRaw),
        availableModelYears: [...record.availableModelYears].sort((a, b) => a - b),
      }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
  }

  return createHash('sha256').update(JSON.stringify(logical), 'utf8').digest('hex')
}
