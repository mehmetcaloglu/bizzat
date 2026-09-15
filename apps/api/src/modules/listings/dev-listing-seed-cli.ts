import { createDatabase } from '../../db/client.js'
import { seedDevelopmentCarListings } from './dev-listing-seed.js'

const ownerUserId = process.argv.slice(2).find((arg) => arg !== '--')

if (!ownerUserId) {
  console.error('Usage: listings:seed:dev <owner-user-uuid>')
  process.exitCode = 1
} else {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const db = createDatabase(databaseUrl)
  try {
    const result = await seedDevelopmentCarListings(db, ownerUserId)
    console.log(JSON.stringify(result))
  } finally {
    await db.destroy()
  }
}
