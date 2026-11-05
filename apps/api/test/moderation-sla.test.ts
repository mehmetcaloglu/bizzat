import { describe, expect, it } from 'vitest'
import {
  MODERATION_DUE_SOON_HOURS,
  MODERATION_SLA_HOURS,
  moderationSla,
  moderationSlaCutoffs,
} from '../src/modules/moderation/moderation-sla.js'

const now = new Date('2026-11-05T12:00:00.000Z')

describe('moderation SLA', () => {
  it('classifies open reports as on track, due soon, or overdue', () => {
    const onTrack = moderationSla(
      new Date(now.getTime() - 2 * 60 * 60 * 1000),
      'open',
      now,
    )
    expect(onTrack?.state).toBe('on_track')

    const dueSoon = moderationSla(
      new Date(now.getTime() - (MODERATION_SLA_HOURS - MODERATION_DUE_SOON_HOURS + 1) * 60 * 60 * 1000),
      'reviewing',
      now,
    )
    expect(dueSoon?.state).toBe('due_soon')

    const overdue = moderationSla(
      new Date(now.getTime() - (MODERATION_SLA_HOURS + 1) * 60 * 60 * 1000),
      'open',
      now,
    )
    expect(overdue?.state).toBe('overdue')
  })

  it('does not apply an SLA to closed reports', () => {
    expect(moderationSla(now, 'resolved', now)).toBeNull()
    expect(moderationSla(now, 'dismissed', now)).toBeNull()
  })

  it('provides overdue and due-soon query cutoffs', () => {
    const cutoffs = moderationSlaCutoffs(now)
    expect(cutoffs.overdueBefore.toISOString()).toBe('2026-11-04T12:00:00.000Z')
    expect(cutoffs.dueSoonBefore.toISOString()).toBe('2026-11-04T16:00:00.000Z')
  })
})
