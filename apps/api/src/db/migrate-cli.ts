import { createAuth, createAuthPool } from '../auth/auth.js'
import { migrateAuth } from '../auth/auth-migrator.js'
import { loadConfig } from '../config/env.js'
import { createDatabase } from './client.js'
import { migrateBootstrap, migrateDomain } from './migrator.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)
const authPool = createAuthPool(config.databaseUrl)
const auth = createAuth({
  databaseUrl: config.databaseUrl,
  baseUrl: config.betterAuthUrl,
  secret: config.betterAuthSecret,
}, authPool)

try {
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  console.log('Database migrations complete')
} finally {
  await db.destroy()
  await authPool.end()
}
