import { describe, expect, it } from 'vitest'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'

describe('reviewed Megane marketplace selections', () => {
  it.each([
    ['122-1161', 'ICON 1.5 DCI EDC 110', 'MEGANE SEDAN ICON 1.5 DCI EDC 110', ['1.5 dCi', 'Icon']],
    ['122-1160', 'ICON 1.5 DCI 110', 'MEGANE SEDAN ICON 1.5 DCI 110', ['1.5 dCi', 'Icon']],
    ['122-1107', 'HB JOY 1.5 DCI 90', 'MEGANE HB JOY 1.5 DCI 90', ['1.5 dCi', 'Joy']],
    ['122-1108', 'HB JOY 1.5 DCI EDC 110', 'MEGANE HB JOY 1.5 DCI EDC 110', ['1.5 dCi', 'Joy']],
    ['122-1088', 'HB GT-LINE 1.5 DCI 110 E5', 'MEGANE HB GT-LINE 1.5 DCI 110 E5', ['1.5 dCi', 'GT Line']],
    ['122-1089', 'HB GT-LINE 1.5 DCI 110 EDC E5', 'MEGANE HB GT-LINE 1.5 DCI 110 EDC E5', ['1.5 dCi', 'GT Line']],
    ['122-1105', 'HB JOY 1.6 16V 110', 'MEGANE HB JOY 1.6 16V 110', ['1.6', 'Joy']],
    ['122-1106', 'HB JOY 1.6 16V 115 CVT', 'MEGANE HB JOY 1.6 16V 115 CVT', ['1.6', 'Joy']],
  ])('maps reviewed TSB source %s to its marketplace path', (_sourceKey, proposed, raw, path) => {
    expect(canonicalModelSelection('renault:megane', proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['ICON 1.5 DCI EDC 110 FAZ2', 'MEGANE SEDAN ICON 1.5 DCI EDC 110 FAZ2'],
    ['HB JOY 1.6 16V 115', 'MEGANE HB JOY 1.6 16V 115'],
    ['HB MYSTERY 1.5 DCI 110', 'MEGANE HB MYSTERY 1.5 DCI 110'],
  ])('keeps an unreviewed Megane source variant in review', (proposed, raw) => {
    expect(canonicalModelSelection('renault:megane', proposed, raw)).toBeNull()
  })
})
