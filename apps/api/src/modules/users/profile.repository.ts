import type { Kysely } from 'kysely'
import type { Database, UserRole } from '../../db/client.js'

export type AccountStatus = 'active' | 'suspended' | 'banned'

export interface Profile {
  userId: string
  role: UserRole
  accountStatus: AccountStatus
  suspendedUntil: Date | null
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

  let profile = await db
    .selectFrom('profiles')
    .select(['user_id', 'role', 'account_status as accountStatus', 'suspended_until as suspendedUntil'])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  if (
    profile.accountStatus === 'suspended'
    && profile.suspendedUntil !== null
    && profile.suspendedUntil.getTime() <= Date.now()
  ) {
    await db
      .updateTable('profiles')
      .set({ account_status: 'active', suspended_until: null, updated_at: new Date() })
      .where('user_id', '=', userId)
      .execute()
    profile = await db
      .selectFrom('profiles')
      .select(['user_id', 'role', 'account_status as accountStatus', 'suspended_until as suspendedUntil'])
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow()
  }

  return {
    userId: profile.user_id,
    role: profile.role,
    accountStatus: profile.accountStatus as AccountStatus,
    suspendedUntil: profile.suspendedUntil,
  }
}
