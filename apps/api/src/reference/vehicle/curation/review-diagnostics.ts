import { normalizeVehicleSourceIdentity } from '../source/source-normalization.js'

export type VehicleModelReviewReason =
  | 'exact-source-review-only'
  | 'missing-series-policy'
  | 'unknown-trim'
  | 'missing-engine-or-badge'
  | 'ambiguous-body'
  | 'drivetrain-needs-branch'
  | 'unsupported-shape'

// Diagnostic mirror of the series that currently have an explicit normalization
// policy in model-label.ts. This metadata must never change mapping behavior.
const REVIEWED_POLICY_SERIES = new Set([
  'renault:clio',
  'volkswagen:polo',
  'volkswagen:golf',
  'peugeot:308',
  'fiat:egea',
  'toyota:corolla',
  'bmw:3-serisi',
  'mercedes-benz:c-serisi',
  'audi:a3',
  'audi:a4',
  'skoda:octavia',
  'skoda:superb',
  'skoda:fabia',
  'skoda:rapid',
])

export function diagnoseVehicleModelReview(
  seriesKey: string,
  proposedModelLabel: string,
  typeRaw: string,
): VehicleModelReviewReason {
  const brand = seriesKey.split(':')[0]!
  const label = normalizeVehicleSourceIdentity(proposedModelLabel)
  const raw = normalizeVehicleSourceIdentity(typeRaw)

  // Explicit marketplace boundaries already enforced by model-label.ts.
  if (seriesKey === 'fiat:egea' && /\bCROSS\b/.test(raw)) return 'unsupported-shape'
  if (brand === 'bmw' && /\b(?:XDRIVE|SDRIVE)\b/.test(label)) return 'drivetrain-needs-branch'
  if (
    brand === 'audi' &&
    ['audi:a3', 'audi:a4'].includes(seriesKey) &&
    !/\b(?:SEDAN|SPORTBACK|AVANT)\b/.test(label)
  ) {
    return 'ambiguous-body'
  }

  if (brand === 'bmw' && !/^(?:M?\d{3}(?:LD|LI|LE|TI|IS|D|I|E))\b/.test(raw)) {
    return 'missing-engine-or-badge'
  }
  if (brand === 'mercedes-benz' && !/^[A-Z]{1,3}\s?\d{2,3}(?:\s?(?:D|K))?\b/.test(raw)) {
    return 'missing-engine-or-badge'
  }

  // For an unresolved row, absence of a reviewed series policy is the first
  // actionable boundary. It does not claim that adding a policy will
  // automatically make the row mappable; it tells us where bulk review should start.
  if (!REVIEWED_POLICY_SERIES.has(seriesKey)) return 'missing-series-policy'

  // Known-policy rows that still have no engine/badge should be reviewed before
  // considering a trim alias.
  if (
    !/\b\d\.\d{1,2}\b/.test(label) &&
    brand !== 'audi' &&
    brand !== 'bmw' &&
    brand !== 'mercedes-benz'
  ) {
    return 'missing-engine-or-badge'
  }

  return 'unknown-trim'
}
