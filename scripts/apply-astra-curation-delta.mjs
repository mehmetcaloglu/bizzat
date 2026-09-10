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
const version = '2026-09-10.3'
const baselineVersion = '2026-09-10.2'

const catalog = read(files.catalog)
const mappings = read(files.mappings)
const backlog = read(files.backlog)
const manifest = read(files.manifest)

const expectedFinal = () => {
  const astra = backlog.series.find((entry) => entry.seriesKey === 'opel:astra')
  const opel = manifest.curation.coverageByKnownBrand.find((entry) => entry.brandKey === 'opel')
  assert(catalog.version === version, 'final catalog version mismatch')
  assert(mappings.version === version, 'final mapping version mismatch')
  assert(backlog.version === version, 'final backlog version mismatch')
  assert(manifest.version === version, 'final manifest version mismatch')
  assert(catalog.brands.length === 19 && catalog.series.length === 56 && catalog.models.length === 600, 'final catalog counts mismatch')
  assert(mappings.mappings.length === 841, 'final mapping count mismatch')
  assert(astra?.sourceRecords === 195 && astra?.mappedSourceCodes === 4 && astra?.modelReviewRequired === 191 && astra?.excludedSourceCodes === 0 && astra?.selectableModels === 3, 'final Astra backlog mismatch')
  assert(opel?.sourceRows === 831 && opel?.['model-review'] === 507 && opel?.mapped === 7 && opel?.excluded === 317 && opel?.selectableLeaves === 6, 'final Opel coverage mismatch')
  assert(manifest.curation.sourceRecords === 27906 && manifest.curation.exactCandidates === 841 && manifest.curation.mappedSourceCodes === 841 && manifest.curation.canonicalBrands === 19 && manifest.curation.canonicalSeries === 56 && manifest.curation.canonicalModels === 600 && manifest.curation.modelReviewRequired === 6038, 'final manifest counts mismatch')
  assert(manifest.curation.reviewedExactSelectionSeries.includes('opel:astra'), 'Astra exact-selection policy missing')
  assert(!manifest.curation.reviewedTechnicalPolicySeries.includes('opel:astra'), 'Astra must not gain generic technical stripping')
}

if ([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === version)) {
  expectedFinal()
  console.log('Astra curation delta already applied')
  process.exit(0)
}

assert([catalog.version, mappings.version, backlog.version, manifest.version].every((value) => value === baselineVersion), 'unexpected curation baseline version')
assert(catalog.brands.length === 19 && catalog.series.length === 55 && catalog.models.length === 597, 'unexpected catalog baseline counts')
assert(mappings.mappings.length === 837, 'unexpected mapping baseline count')
assert(manifest.curation.sourceRecords === 27906 && manifest.curation.exactCandidates === 837 && manifest.curation.mappedSourceCodes === 837 && manifest.curation.canonicalBrands === 19 && manifest.curation.canonicalSeries === 55 && manifest.curation.canonicalModels === 597 && manifest.curation.modelReviewRequired === 6042, 'unexpected manifest baseline counts')

const astraBaseline = backlog.series.find((entry) => entry.seriesKey === 'opel:astra')
assert(JSON.stringify(astraBaseline) === JSON.stringify({
  seriesKey: 'opel:astra',
  sourceRecords: 195,
  mappedSourceCodes: 0,
  modelReviewRequired: 195,
  excludedSourceCodes: 0,
  selectableModels: 0,
}), 'unexpected Astra backlog baseline')

const opelBaseline = manifest.curation.coverageByKnownBrand.find((entry) => entry.brandKey === 'opel')
assert(JSON.stringify(opelBaseline) === JSON.stringify({
  brandKey: 'opel',
  sourceRows: 831,
  'model-review': 511,
  excluded: 317,
  mapped: 3,
  selectableLeaves: 3,
}), 'unexpected Opel coverage baseline')
assert(!manifest.curation.reviewedTechnicalPolicySeries.includes('opel:astra'), 'Astra unexpectedly has generic technical stripping')

const newSeries = { key: 'opel:astra', brandKey: 'opel', name: 'Astra' }
const newModels = [
  {
    key: 'opel:astra:1-3-cdti-cosmo',
    seriesKey: 'opel:astra',
    name: '1.3 CDTI Cosmo',
    selectionPath: [
      { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
      { key: 'opel:astra:1-3-cdti-cosmo', name: 'Cosmo' },
    ],
  },
  {
    key: 'opel:astra:1-3-cdti-enjoy-plus',
    seriesKey: 'opel:astra',
    name: '1.3 CDTI Enjoy Plus',
    selectionPath: [
      { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
      { key: 'opel:astra:1-3-cdti-enjoy-plus', name: 'Enjoy Plus' },
    ],
  },
  {
    key: 'opel:astra:1-3-cdti-sport',
    seriesKey: 'opel:astra',
    name: '1.3 CDTI Sport',
    selectionPath: [
      { key: 'opel:astra:1-3-cdti', name: '1.3 CDTI' },
      { key: 'opel:astra:1-3-cdti-sport', name: 'Sport' },
    ],
  },
]
const newMappings = [
  { sourceKey: '111-1011', vehicleModelKey: 'opel:astra:1-3-cdti-enjoy-plus', method: 'exact-rule' },
  { sourceKey: '111-715', vehicleModelKey: 'opel:astra:1-3-cdti-enjoy-plus', method: 'exact-rule' },
  { sourceKey: '111-716', vehicleModelKey: 'opel:astra:1-3-cdti-sport', method: 'exact-rule' },
  { sourceKey: '111-717', vehicleModelKey: 'opel:astra:1-3-cdti-cosmo', method: 'exact-rule' },
]

const oldSeries = new Map(catalog.series.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldModels = new Map(catalog.models.map((entry) => [entry.key, JSON.stringify(entry)]))
const oldMappings = new Map(mappings.mappings.map((entry) => [entry.sourceKey, JSON.stringify(entry)]))
assert(!oldSeries.has(newSeries.key), 'Astra series already exists unexpectedly')
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
astraBaseline.mappedSourceCodes = 4
astraBaseline.modelReviewRequired = 191
astraBaseline.selectableModels = 3

manifest.version = version
const curation = manifest.curation
curation.exactCandidates = 841
curation.mappedSourceCodes = 841
curation.canonicalSeries = 56
curation.canonicalModels = 600
curation.modelReviewRequired = 6038
opelBaseline['model-review'] = 507
opelBaseline.mapped = 7
opelBaseline.selectableLeaves = 6
if (!curation.reviewedExactSelectionSeries.includes('opel:astra')) curation.reviewedExactSelectionSeries.push('opel:astra')
curation.reviewedExactSelectionSeries.sort()
for (const example of [
  'Opel/Astra/1.3 CDTI/Cosmo',
  'Opel/Astra/1.3 CDTI/Enjoy Plus',
  'Opel/Astra/1.3 CDTI/Sport',
]) {
  if (!curation.reviewedReferenceExamples.includes(example)) curation.reviewedReferenceExamples.push(example)
}
curation.method = 'Exact brand/series aliases, explicit model badges and body paths, known trim vocabulary; unknown engine/body/trim and collisions require review. Technical variants consolidate only when their full reviewed selection path agrees. Seat Ibiza, Renault Megane, Ford Focus and Opel Astra use narrowly reviewed exact normalized source-label mappings for explicitly evidenced paths; this does not enable general technical stripping.'
curation.lastIncrement = {
  baselineVersion,
  purpose: 'Add three reviewed Opel Astra 1.3 CDTI marketplace selection paths from four exact August 2026 TSB source-code labels without enabling generic Astra technical stripping.',
  newReferenceRetrieval: 'Sahibinden public first-party index verified Astra 1.3 CDTI Cosmo/Sport/Enjoy Plus paths. Four TSB code labels already name CDTi explicitly, avoiding a DIZEL-to-CDTI inference. Sedan, DIZEL, S&S and unreviewed Enjoy variants remain review-only. The original operational normalized snapshot was unavailable in this session, so this increment is an explicit reviewed delta rather than a claimed full-snapshot regeneration.',
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
  astraReview: astraBaseline.modelReviewRequired,
  modelReviewRequired: manifest.curation.modelReviewRequired,
}))
