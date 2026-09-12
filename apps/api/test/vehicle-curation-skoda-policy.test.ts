import { describe, expect, it } from 'vitest'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import { diagnoseVehicleModelReview } from '../src/reference/vehicle/curation/review-diagnostics.js'

describe('reviewed Skoda normalization policy batch', () => {
  it.each([
    ['skoda:octavia', 'AMBITION 1.4 TSI 140 DSG', 'OCTAVIA AMBITION 1.4 TSI 140 DSG', ['1.4 TSI', 'Ambition']],
    ['skoda:superb', '1.5 TSI 150 DSG PRESTIGE', 'SUPERB 1.5 TSI 150 DSG PRESTIGE', ['1.5 TSI', 'Prestige']],
    ['skoda:fabia', '1.0 TSI 95 DSG PREMIUM', 'FABIA 1.0 TSI 95 DSG PREMIUM', ['1.0 TSI', 'Premium']],
    ['skoda:rapid', 'AMBITION 1.2 TSI 105', 'RAPID AMBITION 1.2 TSI 105', ['1.2 TSI', 'Ambition']],
  ])('maps conservative conventional row for %s', (series, proposed, raw, path) => {
    expect(canonicalModelSelection(series, proposed, raw)?.path).toEqual(path)
  })

  it.each([
    ['skoda:octavia', 'COMBI 1.6 TDI CR 110 GREEN TEC STYLE', 'OCTAVIA COMBI 1.6 TDI CR 110 GREEN TEC STYLE'],
    ['skoda:octavia', '1.6 TDI CR 110 GREEN TEC 4X4 STYLE', 'OCTAVIA 1.6 TDI CR 110 GREEN TEC 4X4 STYLE'],
    ['skoda:superb', 'COMBI 1.6 TDI CR 120 DSG PRESTIGE', 'SUPERB COMBI 1.6 TDI CR 120 DSG PRESTIGE'],
    ['skoda:superb', '2.0 TSI 280 4X4 DSG PRESTIGE', 'SUPERB 2.0 TSI 280 4X4 DSG PRESTIGE'],
    ['skoda:fabia', 'COMBI 1.2 TSI 110 DSG STYLE', 'FABIA COMBI 1.2 TSI 110 DSG STYLE'],
    ['skoda:rapid', 'SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION', 'RAPID SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION'],
    ['skoda:octavia', '1.5 TSI ACT E-TEC 150 DSG PRESTIGE', 'OCTAVIA 1.5 TSI ACT e-TEC 150 DSG PRESTIGE'],
    ['skoda:superb', '1.5 TSI MHEV 150 DSG PRESTIGE FL', 'SUPERB 1.5 TSI MHEV 150 DSG PRESTIGE FL'],
  ])('keeps branch or technology-bearing row in review for %s', (series, proposed, raw) => {
    expect(canonicalModelSelection(series, proposed, raw)).toBeNull()
  })

  it.each([
    ['skoda:octavia', 'COMBI 1.6 TDI CR 110 GREEN TEC STYLE', 'OCTAVIA COMBI 1.6 TDI CR 110 GREEN TEC STYLE'],
    ['skoda:superb', '2.0 TSI 280 4X4 DSG PRESTIGE', 'SUPERB 2.0 TSI 280 4X4 DSG PRESTIGE'],
    ['skoda:fabia', 'COMBI 1.2 TSI 110 DSG STYLE', 'FABIA COMBI 1.2 TSI 110 DSG STYLE'],
    ['skoda:rapid', 'SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION', 'RAPID SPACEBACK 1.2 TSI 90 GREEN TEC AMBITION'],
  ])('reports unresolved reviewed-policy rows as unknown-trim for %s', (series, proposed, raw) => {
    expect(diagnoseVehicleModelReview(series, proposed, raw)).toBe('unknown-trim')
  })
})
