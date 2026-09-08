import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateToLatest } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')

const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let db: Kysely<Database>
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateToLatest(db)
  await migrateAuth(auth)
})

afterAll(async () => {
  await db.destroy()
  await authPool.end()
})

describe('Better Auth database foundation', () => {
  it('creates the core tables in the auth schema', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name
      from information_schema.tables
      where table_schema = 'auth'
        and table_name in ('user', 'session', 'account', 'verification')
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'account',
      'session',
      'user',
      'verification',
    ])
  })

  it('uses PostgreSQL uuid for the auth user id', async () => {
    const result = await sql<{ data_type: string }>`
      select data_type
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'user'
        and column_name = 'id'
    `.execute(db)

    expect(result.rows).toEqual([{ data_type: 'uuid' }])
  })
})
