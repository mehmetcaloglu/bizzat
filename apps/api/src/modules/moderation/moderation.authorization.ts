import type { Kysely } from 'kysely'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { ensureProfile } from '../users/profile.repository.js'

export async function requireModerator(
  db: Kysely<Database>,
  userId: string,
): Promise<void> {
  const profile = await ensureProfile(db, userId)
  if (profile.role !== 'moderator' && profile.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Bu işlem için moderatör yetkisi gerekiyor.')
  }
}

export async function requireAdmin(
  db: Kysely<Database>,
  userId: string,
): Promise<void> {
  const profile = await ensureProfile(db, userId)
  if (profile.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Bu işlem için admin yetkisi gerekiyor.')
  }
}
