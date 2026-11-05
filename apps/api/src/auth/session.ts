import type { IncomingHttpHeaders } from 'node:http'
import { fromNodeHeaders } from 'better-auth/node'
import type { Kysely } from 'kysely'
import { AppError } from '../common/errors/app-error.js'
import type { Database } from '../db/client.js'
import { ensureProfile } from '../modules/users/profile.repository.js'
import type { BizzatAuth } from './auth.js'

export async function getAuthSession(
  auth: BizzatAuth,
  headers: IncomingHttpHeaders,
) {
  return auth.api.getSession({ headers: fromNodeHeaders(headers) })
}

export async function getActiveAuthSession(
  auth: BizzatAuth,
  db: Kysely<Database>,
  headers: IncomingHttpHeaders,
) {
  const session = await getAuthSession(auth, headers)
  if (!session) return null

  const profile = await ensureProfile(db, session.user.id)
  if (profile.accountStatus === 'banned') {
    throw new AppError(403, 'ACCOUNT_BANNED', 'Bu hesap kalıcı olarak kapatılmış.')
  }
  if (profile.accountStatus === 'suspended') {
    throw new AppError(
      403,
      'ACCOUNT_SUSPENDED',
      'Bu hesap geçici olarak askıya alınmış.',
    )
  }
  return session
}
