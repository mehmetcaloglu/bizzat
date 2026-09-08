import { buildApp } from './app.js'
import { loadConfig } from './config/env.js'
import { checkDatabase } from './db/check.js'
import { createDatabase } from './db/client.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)
const app = buildApp({
  logger: true,
  readinessCheck: () => checkDatabase(db),
})

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await db.destroy()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await db.destroy()
  process.exit(1)
}
