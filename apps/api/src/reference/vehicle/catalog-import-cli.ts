import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createDatabase } from '../../db/client.js'
import { importVehicleCatalog } from './catalog-importer.js'

const inputPath = process.argv.slice(2).find((arg) => arg !== '--')

if (!inputPath) {
  console.error('Usage: reference:import:vehicle-catalog <catalog.json>')
  process.exitCode = 1
} else {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const invocationRoot = process.env.INIT_CWD ?? process.cwd()
  const raw = await readFile(resolve(invocationRoot, inputPath), 'utf8')
  const value: unknown = JSON.parse(raw)
  const db = createDatabase(databaseUrl)

  try {
    const result = await importVehicleCatalog(db, value)
    console.log(JSON.stringify(result))
  } finally {
    await db.destroy()
  }
}
