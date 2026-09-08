import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createDatabase } from '../../../db/client.js'
import { importVehicleSourceSnapshot } from './source-importer.js'
import { validateAndNormalizeVehicleSourceSnapshot } from './source-validator.js'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const [providerAlias, inputPath] = args
if (providerAlias !== 'tsb') {
  throw new Error('Provider alias must be "tsb"')
}
if (!inputPath) {
  throw new Error('Normalized vehicle source JSON path is required')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const invocationRoot = process.env.INIT_CWD ?? process.cwd()
const raw = await readFile(resolve(invocationRoot, inputPath), 'utf8')
const parsed: unknown = JSON.parse(raw)
const snapshot = validateAndNormalizeVehicleSourceSnapshot(parsed)
const db = createDatabase(databaseUrl)

try {
  const result = await importVehicleSourceSnapshot(db, snapshot)
  console.log(JSON.stringify(result))
} finally {
  await db.destroy()
}
