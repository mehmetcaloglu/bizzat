import type { IncomingHttpHeaders } from 'node:http'
import { fromNodeHeaders } from 'better-auth/node'
import type { BizzatAuth } from './auth.js'

export async function getAuthSession(
  auth: BizzatAuth,
  headers: IncomingHttpHeaders,
) {
  return auth.api.getSession({ headers: fromNodeHeaders(headers) })
}
