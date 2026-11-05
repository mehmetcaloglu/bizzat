export const MODERATION_SLA_HOURS = 24
export const MODERATION_DUE_SOON_HOURS = 4

export type ModerationSlaState = 'on_track' | 'due_soon' | 'overdue'

export interface ModerationSla {
  dueAt: Date
  state: ModerationSlaState
}

export function moderationSla(
  createdAt: Date,
  status: string,
  now: Date = new Date(),
): ModerationSla | null {
  if (status !== 'open' && status !== 'reviewing') return null
  const dueAt = new Date(
    createdAt.getTime() + MODERATION_SLA_HOURS * 60 * 60 * 1000,
  )
  const remainingMs = dueAt.getTime() - now.getTime()
  if (remainingMs <= 0) return { dueAt, state: 'overdue' }
  if (remainingMs <= MODERATION_DUE_SOON_HOURS * 60 * 60 * 1000) {
    return { dueAt, state: 'due_soon' }
  }
  return { dueAt, state: 'on_track' }
}

export function moderationSlaCutoffs(now: Date = new Date()): {
  overdueBefore: Date
  dueSoonBefore: Date
} {
  return {
    overdueBefore: new Date(now.getTime() - MODERATION_SLA_HOURS * 60 * 60 * 1000),
    dueSoonBefore: new Date(
      now.getTime() - (MODERATION_SLA_HOURS - MODERATION_DUE_SOON_HOURS) * 60 * 60 * 1000,
    ),
  }
}
