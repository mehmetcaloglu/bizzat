import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createDatabase } from '../../../db/client.js'
import { applyVehicleSourceMappings } from './mapping-service.js'
import { validateVehicleSourceMappingFile } from './mapping-validator.js'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const [providerAlias, inputPath] = args
if (providerAlias !== 'tsb') {
  throw new Error('Provider alias must be "tsb"')
}
if (!inputPath) {
  throw new Error('Vehicle source mapping JSON path is required')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const invocationRoot = process.env.INIT_CWD ?? process.cwd()
const raw = await readFile(resolve(invocationRoot, inputPath), 'utf8')
const parsed: unknown = JSON.parse(raw)
const file = validateVehicleSourceMappingFile(parsed)
const db = createDatabase(databaseUrl)

try {
  const result = await applyVehicleSourceMappings(db, 'tsb-kasko', file)
  console.log(JSON.stringify(result))
} finally {
  await db.destroy()
}
