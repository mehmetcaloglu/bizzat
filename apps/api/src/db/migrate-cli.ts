import { loadConfig } from '../config/env.js'
import { createDatabase } from './client.js'
import { migrateToLatest } from './migrator.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)

try {
  await migrateToLatest(db)
  console.log('Database migrations complete')
} finally {
  await db.destroy()
}
