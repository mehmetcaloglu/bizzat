import { type Generated, Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

export type UserRole = 'user' | 'moderator' | 'admin'

export interface ProfilesTable {
  user_id: string
  role: UserRole
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface Database {
  profiles: ProfilesTable
}

export function createDatabase(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 30000,
      }),
    }),
  })
}
