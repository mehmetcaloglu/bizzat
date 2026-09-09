import type { CanonicalVehicleCatalog } from '../catalog.types.js'
import {
  normalizeVehicleSourceIdentity,
  normalizeVehicleSourceText,
} from '../source/source-normalization.js'
import type { VehicleSourceMappingFile } from '../source/mapping.types.js'
import type { NormalizedVehicleSourceSnapshot } from '../source/source.types.js'
import type {
  VehicleBrandAliasesFile,
  VehicleCurationCandidate,
  VehicleSeriesAliasesFile,
} from './alias.types.js'
import { generateVehicleCurationCandidates } from './candidate-generator.js'
import { canonicalModelSelection } from './model-label.js'

export type VehicleBootstrapModels = Record<string, string[]>

export interface VehicleCatalogGenerationSummary {
  sourceRecords: number
  exactCandidates: number
  mappedSourceCodes: number
  canonicalBrands: number
  canonicalSeries: number
  canonicalModels: number
  slugCollisionsExcluded: number
  ambiguousSeriesExcluded: number
  unknownBrandExcluded: number
  noSeriesExcluded: number
  modelReviewRequired: number
}

export interface GeneratedVehicleCatalogArtifacts {
  catalog: CanonicalVehicleCatalog
  mappings: VehicleSourceMappingFile
  candidates: Array<VehicleCurationCandidate & { modelStatus: 'mapped' | 'model-review' | 'excluded'; vehicleModelKey: string | null }>
  summary: VehicleCatalogGenerationSummary
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleFromAlias(value: string): string {
  return normalizeVehicleSourceText(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s-])([\p{L}])/gu, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('tr-TR')}`,
    )
}

function brandDisplayNames(bootstrapModels: VehicleBootstrapModels): Map<string, string> {
  const result = new Map<string, string>()
  for (const brandName of Object.keys(bootstrapModels)) {
    const key = slugify(brandName)
    if (!result.has(key)) result.set(key, brandName)
  }
  return result
}

function seriesDisplayNames(
  bootstrapModels: VehicleBootstrapModels,
  seriesAliases: VehicleSeriesAliasesFile,
): Map<string, string> {
  const bootstrapBySeriesKey = new Map<string, string>()
  for (const [brandName, models] of Object.entries(bootstrapModels)) {
    const brandKey = slugify(brandName)
    for (const modelName of models) {
      bootstrapBySeriesKey.set(`${brandKey}:${slugify(modelName)}`, modelName)
    }
  }

  const result = new Map<string, string>()
  for (const entry of seriesAliases.entries) {
    const bootstrapName = bootstrapBySeriesKey.get(entry.seriesKey)
    result.set(entry.seriesKey, bootstrapName ?? titleFromAlias(entry.aliases[0]!))
  }
  return result
}

function fallbackBrandName(brandKey: string, aliases: VehicleBrandAliasesFile): string {
  const alias = aliases.aliases.find((item) => item.brandKey === brandKey)?.raw
  return alias ? titleFromAlias(alias.replace(/\s*\([^)]*\)\s*$/u, '')) : titleFromAlias(brandKey.replace(/-/g, ' '))
}

function branchIdentity(seriesKey: string, path: string[], nodeIndex: number): string {
  return JSON.stringify([
    seriesKey,
    path.slice(0, nodeIndex + 1).map(normalizeVehicleSourceIdentity),
  ])
}

export function generateCuratedVehicleCatalog(args: {
  snapshot: NormalizedVehicleSourceSnapshot
  brandAliases: VehicleBrandAliasesFile
  seriesAliases: VehicleSeriesAliasesFile
  bootstrapModels: VehicleBootstrapModels
  version: string
  baseline?: { catalog: CanonicalVehicleCatalog; mappings: VehicleSourceMappingFile }
}): GeneratedVehicleCatalogArtifacts {
  const candidates = generateVehicleCurationCandidates({
    records: args.snapshot.records,
    brandAliases: args.brandAliases,
    seriesAliases: args.seriesAliases,
  })

  const selectionBySourceKey = new Map(candidates.map((candidate) => [
    candidate.sourceKey,
    candidate.seriesKeyCandidate && candidate.proposedModelLabel
      ? canonicalModelSelection(candidate.seriesKeyCandidate, candidate.proposedModelLabel, candidate.typeRaw)
      : null,
  ]))
  const exactCandidates = candidates.map((candidate) => ({
    ...candidate, proposedModelLabel: selectionBySourceKey.get(candidate.sourceKey)?.name ?? null,
  })).filter(
    (candidate): candidate is VehicleCurationCandidate & {
      brandKeyCandidate: string
      seriesKeyCandidate: string
      proposedModelLabel: string
    } =>
      candidate.status === 'exact-series' &&
      candidate.brandKeyCandidate !== null &&
      candidate.seriesKeyCandidate !== null &&
      candidate.proposedModelLabel !== null,
  )

  const byModelKey = new Map<
    string,
    Array<{
      candidate: (typeof exactCandidates)[number]
      normalizedLabel: string
    }>
  >()

  for (const candidate of exactCandidates) {
    const modelSlug = slugify(candidate.proposedModelLabel)
    if (!modelSlug) continue
    const modelKey = `${candidate.seriesKeyCandidate}:${modelSlug}`
    const group = byModelKey.get(modelKey) ?? []
    group.push({
      candidate,
      normalizedLabel: JSON.stringify(selectionBySourceKey.get(candidate.sourceKey)!.path.map(normalizeVehicleSourceIdentity)),
    })
    byModelKey.set(modelKey, group)
  }

  const acceptedModelKeys = new Map<
    string,
    { seriesKey: string; name: string; path: string[]; sourceKeys: string[] }
  >()
  let slugCollisionsExcluded = 0

  for (const [modelKey, group] of byModelKey) {
    const identities = new Set(group.map((item) => item.normalizedLabel))
    if (identities.size !== 1) {
      slugCollisionsExcluded += group.length
      continue
    }

    const sorted = [...group].sort((left, right) =>
      left.candidate.sourceKey.localeCompare(right.candidate.sourceKey),
    )
    const first = sorted[0]!
    acceptedModelKeys.set(modelKey, {
      seriesKey: first.candidate.seriesKeyCandidate,
      name: first.candidate.proposedModelLabel,
      path: selectionBySourceKey.get(first.candidate.sourceKey)!.path,
      sourceKeys: sorted.map((item) => item.candidate.sourceKey),
    })
  }

  // After the first reviewed consolidation, source mappings anchor identities.
  // Display spelling changes must not generate new listing UUIDs. A split/merge
  // of already published identities requires an explicit reviewed migration.
  const baselineModels = new Map(args.baseline?.catalog.models.map((model) => [model.key, model]) ?? [])
  const baselineMappings = new Map(args.baseline?.mappings.mappings.map((mapping) => [mapping.sourceKey, mapping.vehicleModelKey]) ?? [])
  const stableModelKeys = new Map<string, string>()
  const mappedBaselineGeneratedKeys = new Set<string>()
  const claimedKeys = new Set<string>()
  for (const [generatedKey, model] of acceptedModelKeys) {
    const priorKeys = new Set(model.sourceKeys.map((key) => baselineMappings.get(key)).filter((key): key is string => !!key && baselineModels.has(key)))
    if (priorKeys.size > 1) throw new Error(`Identity consolidation requires review: ${generatedKey}`)
    const stableKey = [...priorKeys][0] ?? generatedKey
    const old = baselineModels.get(stableKey)
    if (old && old.seriesKey !== model.seriesKey) throw new Error(`Identity reparenting requires review: ${stableKey}`)
    if (old?.selectionPath && old.selectionPath.length !== model.path.length) throw new Error(`Selection path restructuring requires review: ${stableKey}`)
    if (old && priorKeys.size === 0 && JSON.stringify(old.selectionPath?.map((node) => normalizeVehicleSourceIdentity(node.name))) !== JSON.stringify(model.path.map(normalizeVehicleSourceIdentity))) {
      throw new Error(`Existing key would be repurposed: ${stableKey}`)
    }
    if (claimedKeys.has(stableKey)) throw new Error(`Identity split requires review: ${stableKey}`)
    claimedKeys.add(stableKey)
    stableModelKeys.set(generatedKey, stableKey)
    if (priorKeys.size === 1) mappedBaselineGeneratedKeys.add(generatedKey)
  }

  // Resolve stable intermediate identities once per current series/path, seeded
  // only by accepted leaves that are anchored through reviewed source mappings.
  // This lets a new sibling reuse its existing branch without weakening split,
  // merge, reparent, or path-restructure guards.
  const stableBranchKeys = new Map<string, string>()
  const branchIdentityByStableKey = new Map<string, string>()
  for (const [generatedKey, model] of acceptedModelKeys) {
    if (!mappedBaselineGeneratedKeys.has(generatedKey)) continue
    const stableModelKey = stableModelKeys.get(generatedKey)!
    const old = baselineModels.get(stableModelKey)
    if (!old?.selectionPath) continue

    for (let index = 0; index < model.path.length - 1; index += 1) {
      const stableBranchKey = old.selectionPath[index]!.key
      const identity = branchIdentity(model.seriesKey, model.path, index)
      const existingKey = stableBranchKeys.get(identity)
      if (existingKey !== undefined && existingKey !== stableBranchKey) {
        throw new Error(`Selection branch consolidation requires review: ${identity}`)
      }
      const existingIdentity = branchIdentityByStableKey.get(stableBranchKey)
      if (existingIdentity !== undefined && existingIdentity !== identity) {
        throw new Error(`Selection branch split or reparenting requires review: ${stableBranchKey}`)
      }
      stableBranchKeys.set(identity, stableBranchKey)
      branchIdentityByStableKey.set(stableBranchKey, identity)
    }
  }

  const usedSeriesKeys = new Set(
    [...acceptedModelKeys.values()].map((model) => model.seriesKey),
  )
  const seriesEntryByKey = new Map(args.seriesAliases.entries.map((entry) => [entry.seriesKey, entry]))
  const usedBrandKeys = new Set<string>()
  for (const seriesKey of usedSeriesKeys) {
    const entry = seriesEntryByKey.get(seriesKey)
    if (entry) usedBrandKeys.add(entry.brandKey)
  }

  const bootstrapBrandNames = brandDisplayNames(args.bootstrapModels)
  const bootstrapSeriesNames = seriesDisplayNames(args.bootstrapModels, args.seriesAliases)

  const brands = [...usedBrandKeys]
    .map((brandKey) => ({
      key: brandKey,
      name: bootstrapBrandNames.get(brandKey) ?? fallbackBrandName(brandKey, args.brandAliases),
    }))
    .sort((left, right) => left.key.localeCompare(right.key))

  const series = [...usedSeriesKeys]
    .map((seriesKey) => {
      const entry = seriesEntryByKey.get(seriesKey)
      if (!entry) throw new Error(`Missing reviewed series alias entry for ${seriesKey}`)
      return {
        key: seriesKey,
        brandKey: entry.brandKey,
        name: bootstrapSeriesNames.get(seriesKey) ?? titleFromAlias(entry.aliases[0]!),
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))

  const models = [...acceptedModelKeys.entries()]
    .map(([key, model]) => ({
      key: stableModelKeys.get(key)!,
      seriesKey: model.seriesKey,
      name: model.name,
      selectionPath: model.path.map((name, index) => ({
        key: index === model.path.length - 1
          ? stableModelKeys.get(key)!
          : stableBranchKeys.get(branchIdentity(model.seriesKey, model.path, index))
            ?? `${model.seriesKey}:${model.path.slice(0, index + 1).map(slugify).join(':')}`,
        name,
      })),
    }))
    .sort((left, right) => left.key.localeCompare(right.key))

  const mappings = [...acceptedModelKeys.entries()]
    .flatMap(([vehicleModelKey, model]) =>
      model.sourceKeys.map((sourceKey) => ({
        sourceKey,
        vehicleModelKey: stableModelKeys.get(vehicleModelKey)!,
        method: 'exact-rule' as const,
      })),
    )
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey))

  const mappedTargetBySource = new Map(mappings.map((mapping) => [mapping.sourceKey, mapping.vehicleModelKey]))

  const statusCount = (status: VehicleCurationCandidate['status']): number =>
    candidates.filter((candidate) => candidate.status === status).length

  return {
    catalog: {
      version: args.version,
      brands,
      series,
      models,
    },
    mappings: {
      version: args.version,
      mappings,
    },
    candidates: candidates.map((candidate) => {
      const target = mappedTargetBySource.get(candidate.sourceKey) ?? null
      return { ...candidate, modelStatus: target ? 'mapped' : candidate.status === 'exact-series' ? 'model-review' : 'excluded', vehicleModelKey: target }
    }),
    summary: {
      sourceRecords: args.snapshot.records.length,
      exactCandidates: exactCandidates.length,
      mappedSourceCodes: mappings.length,
      canonicalBrands: brands.length,
      canonicalSeries: series.length,
      canonicalModels: models.length,
      slugCollisionsExcluded,
      ambiguousSeriesExcluded: statusCount('ambiguous-series'),
      unknownBrandExcluded: statusCount('unknown-brand'),
      noSeriesExcluded: statusCount('no-series'),
      modelReviewRequired: candidates.filter((candidate) => candidate.status === 'exact-series' && !selectionBySourceKey.get(candidate.sourceKey)).length,
    },
  }
}
