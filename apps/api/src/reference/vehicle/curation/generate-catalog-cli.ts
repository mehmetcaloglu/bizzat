import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateAndNormalizeVehicleSourceSnapshot } from '../source/source-validator.js'
import { validateVehicleBrandAliases, validateVehicleSeriesAliases } from './alias-validator.js'
import {
  generateCuratedVehicleCatalog,
  type VehicleBootstrapModels,
} from './catalog-generator.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateBootstrapModels(value: unknown): VehicleBootstrapModels {
  if (!isObject(value)) throw new Error('Bootstrap models must be an object')

  const result: VehicleBootstrapModels = {}
  for (const [brand, models] of Object.entries(value)) {
    if (!brand.trim() || !Array.isArray(models) || models.length === 0) {
      throw new Error(`Invalid bootstrap entry for brand: ${brand || '<blank>'}`)
    }

    const normalizedModels: string[] = []
    for (const model of models) {
      if (typeof model !== 'string' || !model.trim()) {
        throw new Error(`Invalid bootstrap model under brand: ${brand}`)
      }
      normalizedModels.push(model.trim())
    }
    result[brand.trim()] = normalizedModels
  }

  return result
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const [snapshotArg, brandAliasesArg, seriesAliasesArg, bootstrapArg, outputDirArg, versionArg] = args

if (!snapshotArg || !brandAliasesArg || !seriesAliasesArg || !bootstrapArg || !outputDirArg) {
  console.error(
    'Usage: reference:generate:vehicle-catalog <normalized-tsb.json> <brand-aliases.json> <series-aliases.json> <bootstrap-models.json> <output-dir> [version]',
  )
  process.exitCode = 1
} else {
  const invocationRoot = process.env.INIT_CWD ?? process.cwd()
  const snapshot = validateAndNormalizeVehicleSourceSnapshot(
    await readJson(resolve(invocationRoot, snapshotArg)),
  )
  const brandAliases = validateVehicleBrandAliases(
    await readJson(resolve(invocationRoot, brandAliasesArg)),
  )
  const seriesAliases = validateVehicleSeriesAliases(
    await readJson(resolve(invocationRoot, seriesAliasesArg)),
  )
  const bootstrapModels = validateBootstrapModels(
    await readJson(resolve(invocationRoot, bootstrapArg)),
  )
  const outputDir = resolve(invocationRoot, outputDirArg)
  const version = versionArg?.trim() || snapshot.provider.version

  const result = generateCuratedVehicleCatalog({
    snapshot,
    brandAliases,
    seriesAliases,
    bootstrapModels,
    version,
  })

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeJson(resolve(outputDir, 'catalog.generated.json'), result.catalog),
    writeJson(resolve(outputDir, 'tsb-mappings.generated.json'), result.mappings),
    writeJson(resolve(outputDir, 'candidates.json'), result.candidates),
    writeJson(resolve(outputDir, 'summary.json'), result.summary),
  ])

  console.log(JSON.stringify(result.summary))
}
