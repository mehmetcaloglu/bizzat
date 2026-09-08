import { createDatabase } from '../../../db/client.js'
import { buildVehicleSourceCoverageReport } from './source-report.js'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const [providerAlias] = args
if (providerAlias !== 'tsb') {
  throw new Error('Provider alias must be "tsb"')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const db = createDatabase(databaseUrl)

try {
  const report = await buildVehicleSourceCoverageReport(db, 'tsb-kasko')
  console.log(JSON.stringify(report))
} finally {
  await db.destroy()
}
