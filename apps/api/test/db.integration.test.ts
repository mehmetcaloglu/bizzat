import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { createDatabase, type Database } from '../src/db/client.js'
import { checkDatabase } from '../src/db/check.js'
import { migrateToLatest } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')

let db: Kysely<Database>

beforeAll(() => {
  db = createDatabase(databaseUrl)
})

afterAll(async () => {
  await db.destroy()
})

describe('database foundation', () => {
  it('connects to PostgreSQL', async () => {
    await expect(checkDatabase(db)).resolves.toBeUndefined()
  })

  it('runs versioned migrations and creates auth schema', async () => {
    await migrateToLatest(db)

    const result = await sql<{ schema_name: string }>`
      select schema_name
      from information_schema.schemata
      where schema_name = 'auth'
    `.execute(db)

    expect(result.rows).toEqual([{ schema_name: 'auth' }])
  })
})
