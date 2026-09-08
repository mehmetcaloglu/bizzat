import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
})

afterAll(async () => {
  await db.destroy()
  await authPool.end()
})

describe('vehicle source schema', () => {
  it('creates source provenance/mapping tables and enforces foreign keys', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'vehicle_source_providers',
          'vehicle_source_imports',
          'vehicle_source_records',
          'vehicle_source_mappings'
        )
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'vehicle_source_imports',
      'vehicle_source_mappings',
      'vehicle_source_providers',
      'vehicle_source_records',
    ])

    await expect(sql`
      insert into vehicle_source_imports (provider_id, version, checksum_sha256)
      values ('00000000-0000-0000-0000-000000000000', 'fk-test', 'abc')
    `.execute(db)).rejects.toThrow()
  })
})
