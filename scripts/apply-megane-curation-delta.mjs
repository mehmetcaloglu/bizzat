import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const dataDir = join(root, 'data/reference/vehicles')
const files = {
  catalog: join(dataDir, 'catalog.json'),
  mappings: join(dataDir, 'tsb-mappings.json'),
  backlog: join(dataDir, 'curation-backlog.json'),
  manifest: join(dataDir, 'source-manifest.json'),
}
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const version = '2026-09-10.1'
const baselineVersion = '2026-09-09.3'

const catalog = read(files.catalog)
const mappings = read(files.mappings)
const backlog = read(files.backlog)
const manifest = read(files.manifest)

const expectedFinal = () => {
  const megane = backlog.series.find((entry) => entry.seriesKey === 'renault:megane')
  assert(catalog.version === version, 'final catalog version mismatch')
  assert(mappings.version === version, 'final mapping version mismatch')
  assert(backlog.version === version, 'final backlog version mismatch')
  assert(manifest.version === version, 'final manifest version mismatch')
  assert(catalog.brands.length === 19 && catalog.series.length === 54 && catalog.models.length === 593, 'final catalog counts mismatch')
  assert(mappings.mappings.length === 831, 'final mapping count mismatch')
  assert(megane?.mappedSourceCodes === 8 && megane?.modelReviewRequired === 179 && megane?.selectableModels === 4, 'final Megane backlog mismatch')
  assert(manifest.curation.mappedSourceCodes === 831 && manifest.curation.canonicalSeries === 54 && manifest.curation.canonicalModels === 593 && manifest.curation.modelReviewRequired === 6048, 'final manifest counts mismatch')
}

if ([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === version)) {
  expectedFinal()
  console.log('Megane curation delta already applied')
  process.exit(0)
}

assert([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === baselineVersion), 'unexpected curation baseline version')
assert(catalog.brands.length === 19 && catalog.series.length === 53 && catalog.models.length === 589, 'unexpected catalog baseline counts')
assert(mappings.mappings.length === 823, 'unexpected mapping baseline count')
assert(manifest.curation.sourceRecords === 27906 && manifest.curation.exactCandidates === 823 && manifest.curation.mappedSourceCodes === 823 && manifest.curation.canonicalBrands === 19 && manifest.curation.canonicalSeries === 53 && manifest.curation.canonicalModels === 589 && manifest.curation.modelReviewRequired === 6056, 'unexpected manifest baseline counts')

const newSeries = { key: 'renault:megane', brandKey: 'renault', name: 'Megane' }
const newModels = [
  { key: 'renault:megane:1-5-dci-gt-line', seriesKey: 'renault:megane', name: '1.5 dCi GT Line', selectionPath: [{ key: 'renault:megane:1-5-dci', name: '1.5 dCi' }, { key: 'renault:megane:1-5-dci-gt-line', name: 'GT Line' }] },
  { key: 'renault:megane:1-5-dci-icon', seriesKey: 'renault:megane', name: '1.5 dCi Icon', selectionPath: [{ key: 'renault:megane:1-5-dci', name: '1.5 dCi' }, { key: 'renault:megane:1-5-dci-icon', name: 'Icon' }] },
  { key: 'renault:megane:1-5-dci-joy', seriesKey: 'renault:megane', name: '1.5 dCi Joy', selectionPath: [{ key: 'renault:megane:1-5-dci', name: '1.5 dCi' }, { key: 'renault:megane:1-5-dci-joy', name: 'Joy' }] },
  { key: 'renault:megane:1-6-joy', seriesKey: 'renault:megane', name: '1.6 Joy', selectionPath: [{ key: 'renault:megane:1-6', name: '1.6' }, { key: 'renault:megane:1-6-joy', name: 'Joy' }] },
]
const newMappings = [
  { sourceKey: '122-1088', vehicleModelKey: 'renault:megane:1-5-dci-gt-line', method: 'exact-rule' },
  { sourceKey: '122-1089', vehicleModelKey: 'renault:megane:1-5-dci-gt-line', method: 'exact-rule' },
  { sourceKey: '122-1105', vehicleModelKey: 'renault:megane:1-6-joy', method: 'exact-rule' },
  { sourceKey: '122-1106', vehicleModelKey: 'renault:megane:1-6-joy', method: 'exact-rule' },
  { sourceKey: '122-1107', vehicleModelKey: 'renault:megane:1-5-dci-joy', method: 'exact-rule' },
  { sourceKey: '122-1108', vehicleModelKey: 'renault:megane:1-5-dci-joy', method: 'exact-rule' },
  { sourceKey: '122-1160', vehicleModelKey: 'renault:megane:1-5-dci-icon', method: 'exact-rule' },
  { sourceKey: '122-1161', vehicleModelKey: 'renault:megane:1-5-dci-icon', method: 'exact-rule' },
]

const oldSeries = new Map(catalog.series.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldModels = new Map(catalog.models.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldMappings = new Map(mappings.mappings.map((entry) => [entry.sourceKey, JSON.stringify(entry)]))
assert(!oldSeries.has(newSeries.key), 'Megane series already exists unexpectedly')
for (const entry of newModels) assert(!oldModels.has(entry.key), `model already exists: ${entry.key}`)
for (const entry of newMappings) assert(!oldMappings.has(entry.sourceKey), `mapping already exists: ${entry.sourceKey}`)

catalog.version = version
catalog.series.push(newSeries)
catalog.series.sort((a, b) => a.key.localeCompare(b.key))
catalog.models.push(...newModels)
catalog.models.sort((a, b) => a.key.localeCompare(b.key))

mappings.version = version
mappings.mappings.push(...newMappings)
mappings.mappings.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))

backlog.version = version
const megane = backlog.series.find((entry) => entry.seriesKey === 'renault:megane')
assert(JSON.stringify(megane) === JSON.stringify({ seriesKey: 'renault:megane', sourceRecords: 187, mappedSourceCodes: 0, modelReviewRequired: 187, excludedSourceCodes: 0, selectableModels: 0 }), 'unexpected Megane backlog baseline')
megane.mappedSourceCodes = 8
megane.modelReviewRequired = 179
megane.selectableModels = 4

manifest.version = version
const curation = manifest.curation
curation.exactCandidates = 831
curation.mappedSourceCodes = 831
curation.canonicalSeries = 54
curation.canonicalModels = 593
curation.modelReviewRequired = 6048
const renault = curation.coverageByKnownBrand.find((entry) => entry.brandKey === 'renault')
assert(JSON.stringify(renault) === JSON.stringify({ brandKey: 'renault', sourceRows: 958, 'model-review': 388, mapped: 95, excluded: 475, selectableLeaves: 51 }), 'unexpected Renault coverage baseline')
renault['model-review'] = 380
renault.mapped = 103
renault.selectableLeaves = 55
assert(!curation.reviewedTechnicalPolicySeries.includes('renault:megane'), 'Megane must not gain generic technical stripping')
if (!curation.reviewedExactSelectionSeries.includes('renault:megane')) curation.reviewedExactSelectionSeries.push('renault:megane')
curation.reviewedExactSelectionSeries.sort()
for (const example of ['Renault/Megane/1.5 dCi/Icon', 'Renault/Megane/1.5 dCi/Joy', 'Renault/Megane/1.5 dCi/GT Line', 'Renault/Megane/1.6/Joy']) {
  if (!curation.reviewedReferenceExamples.includes(example)) curation.reviewedReferenceExamples.push(example)
}
curation.method = 'Exact brand/series aliases, explicit model badges and body paths, known trim vocabulary; unknown engine/body/trim and collisions require review. Technical variants consolidate only when their full reviewed selection path agrees. Seat Ibiza and Renault Megane use narrowly reviewed exact normalized source-label mappings for explicitly evidenced paths; this does not enable general technical stripping.'
curation.lastIncrement = {
  baselineVersion,
  purpose: 'Add four reviewed Renault Megane marketplace selection paths from eight exact August 2026 TSB source-code labels without enabling generic Megane technical stripping.',
  newReferenceRetrieval: 'Sahibinden public index verified Megane 1.5 dCi Icon/Joy/GT-Line and 1.6 Joy paths. The eight TSB code labels were re-checked against August 2026 mirrors; the original operational normalized snapshot was unavailable in this session, so this increment is an explicit reviewed delta rather than a claimed full-snapshot regeneration.',
}

for (const [key, before] of oldSeries) assert(JSON.stringify(catalog.series.find((entry) => entry.key === key)) === before, `existing series changed: ${key}`)
for (const [key, before] of oldModels) assert(JSON.stringify(catalog.models.find((entry) => entry.key === key)) === before, `existing model changed: ${key}`)
for (const [key, before] of oldMappings) assert(JSON.stringify(mappings.mappings.find((entry) => entry.sourceKey === key)) === before, `existing mapping changed: ${key}`)

write(files.catalog, catalog)
write(files.mappings, mappings)
write(files.backlog, backlog)
write(files.manifest, manifest)
expectedFinal()
console.log(JSON.stringify({ brands: catalog.brands.length, series: catalog.series.length, models: catalog.models.length, mappings: mappings.mappings.length, meganeReview: megane.modelReviewRequired }))
