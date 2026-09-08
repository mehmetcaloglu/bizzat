import {
  normalizeVehicleSourceIdentity,
  normalizeVehicleSourceText,
} from '../source/source-normalization.js'
import type { NormalizedVehicleSourceSnapshot } from '../source/source.types.js'
import type {
  VehicleBrandAliasesFile,
  VehicleCurationCandidate,
  VehicleSeriesAliasesFile,
} from './alias.types.js'

interface SeriesMatch {
  seriesKey: string
  alias: string
  start: number
  length: number
}

const WORD_CHAR = /[\p{L}\p{N}]/u

function isWordChar(value: string | undefined): boolean {
  return value !== undefined && WORD_CHAR.test(value)
}

function findTokenBoundaryMatch(haystack: string, needle: string): number | null {
  let start = haystack.indexOf(needle)
  while (start >= 0) {
    const before = start === 0 ? undefined : haystack[start - 1]
    const end = start + needle.length
    const after = end >= haystack.length ? undefined : haystack[end]
    if (!isWordChar(before) && !isWordChar(after)) return start
    start = haystack.indexOf(needle, start + 1)
  }
  return null
}

function proposedLabel(typeIdentity: string, match: SeriesMatch): string | null {
  const withoutAlias = `${typeIdentity.slice(0, match.start)} ${typeIdentity.slice(
    match.start + match.length,
  )}`
  const label = normalizeVehicleSourceText(withoutAlias)
  return label || null
}

export function generateVehicleCurationCandidates(args: {
  records: NormalizedVehicleSourceSnapshot['records']
  brandAliases: VehicleBrandAliasesFile
  seriesAliases: VehicleSeriesAliasesFile
}): VehicleCurationCandidate[] {
  const brandByAlias = new Map<string, string>()
  for (const alias of args.brandAliases.aliases) {
    brandByAlias.set(normalizeVehicleSourceIdentity(alias.raw), alias.brandKey)
  }

  const seriesByBrand = new Map<
    string,
    Array<{ seriesKey: string; alias: string; normalizedAlias: string }>
  >()
  for (const entry of args.seriesAliases.entries) {
    const list = seriesByBrand.get(entry.brandKey) ?? []
    for (const alias of entry.aliases) {
      list.push({
        seriesKey: entry.seriesKey,
        alias,
        normalizedAlias: normalizeVehicleSourceIdentity(alias),
      })
    }
    seriesByBrand.set(entry.brandKey, list)
  }

  return args.records.map((record) => {
    const brandKey = brandByAlias.get(normalizeVehicleSourceIdentity(record.brandRaw))
    if (!brandKey) {
      return {
        sourceKey: record.sourceKey,
        brandRaw: record.brandRaw,
        typeRaw: record.typeRaw,
        brandKeyCandidate: null,
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'unknown-brand',
      }
    }

    const typeIdentity = normalizeVehicleSourceIdentity(record.typeRaw)
    const matches: SeriesMatch[] = []
    for (const candidate of seriesByBrand.get(brandKey) ?? []) {
      const start = findTokenBoundaryMatch(typeIdentity, candidate.normalizedAlias)
      if (start === null) continue
      matches.push({
        seriesKey: candidate.seriesKey,
        alias: candidate.alias,
        start,
        length: candidate.normalizedAlias.length,
      })
    }

    if (matches.length === 0) {
      return {
        sourceKey: record.sourceKey,
        brandRaw: record.brandRaw,
        typeRaw: record.typeRaw,
        brandKeyCandidate: brandKey,
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'no-series',
      }
    }

    const longestLength = Math.max(...matches.map((match) => match.length))
    const longest = matches.filter((match) => match.length === longestLength)
    const seriesKeys = new Set(longest.map((match) => match.seriesKey))
    if (seriesKeys.size !== 1) {
      return {
        sourceKey: record.sourceKey,
        brandRaw: record.brandRaw,
        typeRaw: record.typeRaw,
        brandKeyCandidate: brandKey,
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'ambiguous-series',
      }
    }

    const winner = longest.sort((left, right) => left.start - right.start)[0]!
    const label = proposedLabel(typeIdentity, winner)
    if (!label) {
      return {
        sourceKey: record.sourceKey,
        brandRaw: record.brandRaw,
        typeRaw: record.typeRaw,
        brandKeyCandidate: brandKey,
        seriesKeyCandidate: null,
        proposedModelLabel: null,
        status: 'no-series',
      }
    }

    return {
      sourceKey: record.sourceKey,
      brandRaw: record.brandRaw,
      typeRaw: record.typeRaw,
      brandKeyCandidate: brandKey,
      seriesKeyCandidate: winner.seriesKey,
      proposedModelLabel: label,
      status: 'exact-series',
    }
  })
}
