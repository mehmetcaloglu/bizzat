import type { Kysely } from 'kysely'
import type { Database, UserRole } from '../../db/client.js'

export interface Profile {
  userId: string
  role: UserRole
}

export async function ensureProfile(
  db: Kysely<Database>,
  userId: string,
): Promise<Profile> {
  await db
    .insertInto('profiles')
    .values({ user_id: userId, role: 'user' })
    .onConflict((conflict) => conflict.column('user_id').doNothing())
    .execute()

  const profile = await db
    .selectFrom('profiles')
    .select(['user_id', 'role'])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  return { userId: profile.user_id, role: profile.role }
}
