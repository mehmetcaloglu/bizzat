import { createHmac } from 'node:crypto'

export const REPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
export const MEMBER_REPORT_HOURLY_LIMIT = 10
export const GUEST_REPORT_HOURLY_LIMIT = 5

export function hashReporterIp(
  ip: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.REPORT_RATE_LIMIT_SECRET?.trim() || env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('REPORT_RATE_LIMIT_SECRET or BETTER_AUTH_SECRET is required.')
  }
  return createHmac('sha256', secret).update(`report:${ip}`).digest('hex')
}
