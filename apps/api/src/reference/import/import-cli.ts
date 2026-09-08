import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createDatabase } from '../../db/client.js'
import type { NormalizedLocationSnapshot } from './location-import.types.js'
import { importLocationSnapshot } from './location-importer.js'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: reference:import:locations <snapshot.json>')
  process.exitCode = 1
} else {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const invocationRoot = process.env.INIT_CWD ?? process.cwd()
  const raw = await readFile(resolve(invocationRoot, inputPath), 'utf8')
  const snapshot = JSON.parse(raw) as NormalizedLocationSnapshot
  const db = createDatabase(databaseUrl)

  try {
    const result = await importLocationSnapshot(db, snapshot)
    console.log(JSON.stringify({ checksum: result.checksum, counts: result.counts }))
  } finally {
    await db.destroy()
  }
}
