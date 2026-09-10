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
const version = '2026-09-10.2'
const baselineVersion = '2026-09-10.1'

const catalog = read(files.catalog)
const mappings = read(files.mappings)
const backlog = read(files.backlog)
const manifest = read(files.manifest)

const expectedFinal = () => {
  const focus = backlog.series.find((entry) => entry.seriesKey === 'ford:focus')
  const ford = manifest.curation.coverageByKnownBrand.find((entry) => entry.brandKey === 'ford')
  assert(catalog.version === version, 'final catalog version mismatch')
  assert(mappings.version === version, 'final mapping version mismatch')
  assert(backlog.version === version, 'final backlog version mismatch')
  assert(manifest.version === version, 'final manifest version mismatch')
  assert(catalog.brands.length === 19 && catalog.series.length === 55 && catalog.models.length === 597, 'final catalog counts mismatch')
  assert(mappings.mappings.length === 837, 'final mapping count mismatch')
  assert(focus?.sourceRecords === 218 && focus?.mappedSourceCodes === 6 && focus?.modelReviewRequired === 212 && focus?.excludedSourceCodes === 0 && focus?.selectableModels === 4, 'final Focus backlog mismatch')
  assert(ford?.sourceRows === 1562 && ford?.['model-review'] === 389 && ford?.mapped === 9 && ford?.excluded === 1164 && ford?.selectableLeaves === 7, 'final Ford coverage mismatch')
  assert(manifest.curation.sourceRecords === 27906 && manifest.curation.exactCandidates === 837 && manifest.curation.mappedSourceCodes === 837 && manifest.curation.canonicalBrands === 19 && manifest.curation.canonicalSeries === 55 && manifest.curation.canonicalModels === 597 && manifest.curation.modelReviewRequired === 6042, 'final manifest counts mismatch')
  assert(manifest.curation.reviewedExactSelectionSeries.includes('ford:focus'), 'Focus exact-selection policy missing')
  assert(!manifest.curation.reviewedTechnicalPolicySeries.includes('ford:focus'), 'Focus must not gain generic technical stripping')
}

if ([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === version)) {
  expectedFinal()
  console.log('Focus curation delta already applied')
  process.exit(0)
}

assert([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === baselineVersion), 'unexpected curation baseline version')
assert(catalog.brands.length === 19 && catalog.series.length === 54 && catalog.models.length === 593, 'unexpected catalog baseline counts')
assert(mappings.mappings.length === 831, 'unexpected mapping baseline count')
assert(manifest.curation.sourceRecords === 27906 && manifest.curation.exactCandidates === 831 && manifest.curation.mappedSourceCodes === 831 && manifest.curation.canonicalBrands === 19 && manifest.curation.canonicalSeries === 54 && manifest.curation.canonicalModels === 593 && manifest.curation.modelReviewRequired === 6048, 'unexpected manifest baseline counts')

const focusBaseline = backlog.series.find((entry) => entry.seriesKey === 'ford:focus')
assert(JSON.stringify(focusBaseline) === JSON.stringify({
  seriesKey: 'ford:focus',
  sourceRecords: 218,
  mappedSourceCodes: 0,
  modelReviewRequired: 218,
  excludedSourceCodes: 0,
  selectableModels: 0,
}), 'unexpected Focus backlog baseline')

const fordBaseline = manifest.curation.coverageByKnownBrand.find((entry) => entry.brandKey === 'ford')
assert(JSON.stringify(fordBaseline) === JSON.stringify({
  brandKey: 'ford',
  sourceRows: 1562,
  'model-review': 395,
  excluded: 1164,
  mapped: 3,
  selectableLeaves: 3,
}), 'unexpected Ford coverage baseline')
assert(!manifest.curation.reviewedTechnicalPolicySeries.includes('ford:focus'), 'Focus unexpectedly has generic technical stripping')

const newSeries = { key: 'ford:focus', brandKey: 'ford', name: 'Focus' }
const newModels = [
  {
    key: 'ford:focus:1-5-tdci-st-line',
    seriesKey: 'ford:focus',
    name: '1.5 TDCi ST Line',
    selectionPath: [
      { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
      { key: 'ford:focus:1-5-tdci-st-line', name: 'ST Line' },
    ],
  },
  {
    key: 'ford:focus:1-5-tdci-style',
    seriesKey: 'ford:focus',
    name: '1.5 TDCi Style',
    selectionPath: [
      { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
      { key: 'ford:focus:1-5-tdci-style', name: 'Style' },
    ],
  },
  {
    key: 'ford:focus:1-5-tdci-titanium',
    seriesKey: 'ford:focus',
    name: '1.5 TDCi Titanium',
    selectionPath: [
      { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
      { key: 'ford:focus:1-5-tdci-titanium', name: 'Titanium' },
    ],
  },
  {
    key: 'ford:focus:1-5-tdci-trend-x',
    seriesKey: 'ford:focus',
    name: '1.5 TDCi Trend X',
    selectionPath: [
      { key: 'ford:focus:1-5-tdci', name: '1.5 TDCi' },
      { key: 'ford:focus:1-5-tdci-trend-x', name: 'Trend X' },
    ],
  },
]
const newMappings = [
  { sourceKey: '53-2120', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
  { sourceKey: '53-2123', vehicleModelKey: 'ford:focus:1-5-tdci-style', method: 'exact-rule' },
  { sourceKey: '53-2126', vehicleModelKey: 'ford:focus:1-5-tdci-titanium', method: 'exact-rule' },
  { sourceKey: '53-2196', vehicleModelKey: 'ford:focus:1-5-tdci-st-line', method: 'exact-rule' },
  { sourceKey: '53-2251', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
  { sourceKey: '53-2254', vehicleModelKey: 'ford:focus:1-5-tdci-trend-x', method: 'exact-rule' },
]

const oldSeries = new Map(catalog.series.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldModels = new Map(catalog.models.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldMappings = new Map(mappings.mappings.map((entry) => [entry.sourceKey, JSON.stringify(entry)]))
assert(!oldSeries.has(newSeries.key), 'Focus series already exists unexpectedly')
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
focusBaseline.mappedSourceCodes = 6
focusBaseline.modelReviewRequired = 212
focusBaseline.selectableModels = 4

manifest.version = version
const curation = manifest.curation
curation.exactCandidates = 837
curation.mappedSourceCodes = 837
curation.canonicalSeries = 55
curation.canonicalModels = 597
curation.modelReviewRequired = 6042
fordBaseline['model-review'] = 389
fordBaseline.mapped = 9
fordBaseline.selectableLeaves = 7
if (!curation.reviewedExactSelectionSeries.includes('ford:focus')) curation.reviewedExactSelectionSeries.push('ford:focus')
curation.reviewedExactSelectionSeries.sort()
for (const example of [
  'Ford/Focus/1.5 TDCi/Style',
  'Ford/Focus/1.5 TDCi/Titanium',
  'Ford/Focus/1.5 TDCi/Trend X',
  'Ford/Focus/1.5 TDCi/ST Line',
]) {
  if (!curation.reviewedReferenceExamples.includes(example)) curation.reviewedReferenceExamples.push(example)
}
curation.method = 'Exact brand/series aliases, explicit model badges and body paths, known trim vocabulary; unknown engine/body/trim and collisions require review. Technical variants consolidate only when their full reviewed selection path agrees. Seat Ibiza, Renault Megane and Ford Focus use narrowly reviewed exact normalized source-label mappings for explicitly evidenced paths; this does not enable general technical stripping.'
curation.lastIncrement = {
  baselineVersion,
  purpose: 'Add four reviewed Ford Focus 1.5 TDCi marketplace selection paths from six exact August 2026 TSB source-code labels without enabling generic Focus technical stripping.',
  newReferenceRetrieval: 'Sahibinden public first-party index verified Focus 1.5 TDCi ST Line/Style/Titanium/Trend X paths. Six August 2026 TSB code labels were cross-checked against public mirrors; SW Trend X and near body/technical variants remain review-only. The original operational normalized snapshot was unavailable in this session, so this increment is an explicit reviewed delta rather than a claimed full-snapshot regeneration.',
}

for (const [key, before] of oldSeries) assert(JSON.stringify(catalog.series.find((entry) => entry.key === key)) === before, `existing series changed: ${key}`)
for (const [key, before] of oldModels) assert(JSON.stringify(catalog.models.find((entry) => entry.key === key)) === before, `existing model changed: ${key}`)
for (const [key, before] of oldMappings) assert(JSON.stringify(mappings.mappings.find((entry) => entry.sourceKey === key)) === before, `existing mapping changed: ${key}`)

write(files.catalog, catalog)
write(files.mappings, mappings)
write(files.backlog, backlog)
write(files.manifest, manifest)
expectedFinal()
console.log(JSON.stringify({
  brands: catalog.brands.length,
  series: catalog.series.length,
  models: catalog.models.length,
  mappings: mappings.mappings.length,
  focusReview: focusBaseline.modelReviewRequired,
  modelReviewRequired: manifest.curation.modelReviewRequired,
}))
