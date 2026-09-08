import { createAuth, createAuthPool } from './auth/auth.js'
import { buildApp } from './app.js'
import { loadConfig } from './config/env.js'
import { checkDatabase } from './db/check.js'
import { createDatabase } from './db/client.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)
const authPool = createAuthPool(config.databaseUrl)
const auth = createAuth({
  databaseUrl: config.databaseUrl,
  baseUrl: config.betterAuthUrl,
  secret: config.betterAuthSecret,
}, authPool)
const app = buildApp({
  logger: true,
  readinessCheck: () => checkDatabase(db),
  auth,
  authBaseUrl: config.betterAuthUrl,
  db,
})

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await db.destroy()
  await authPool.end()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await db.destroy()
  await authPool.end()
  process.exit(1)
}
