import { describe, expect, it } from 'vitest'
import { canonicalModelSelection } from '../src/reference/vehicle/curation/model-label.js'
import { diagnoseVehicleModelReview } from '../src/reference/vehicle/curation/review-diagnostics.js'

describe('reviewed Skoda normalization policy batch', () => {
  it.each([
    ['skoda:octavia', 'AMBIENTE 1.4 TSI 122', 'OCTAVIA AMBIENTE 1.4 TSI (122)', ['1.4 TSI', 'Ambiente']],
    ['skoda:superb', 'COMFORT 1.4 TSI 125', 'SUPERB COMFORT 1.4 TSI (125)', ['1.4 TSI', 'Comfort']],
    ['skoda:fabia', '1.0 TSI 95 DSG PREMIUM', 'FABIA 1.0 TSI 95 DSG PREMIUM', ['1.0 TSI', 'Premium']],
    ['skoda:rapid', 'AMBITION 1.2 TSI 105', 'RAPID AMBITION 1.2 TSI 105', ['1.2 TSI', 'Ambition']],
  ])('maps marketplace-evidenced conventional row for %s', (series, proposed, raw, path) => {
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
    ['skoda:rapid', '1.0 TSI 110 DSG STYLE', 'RAPID 1.0 TSI 110 DSG STYLE'],
    ['skoda:fabia', 'CLASSIC 1.2 70 PLUS', 'FABIA CLASSIC 1.2 (70) PLUS'],
    ['skoda:fabia', 'CLASSIC 1.4 TDI 70 PLUS', 'FABIA CLASSIC 1.4 TDI (70) PLUS'],
    ['skoda:octavia', 'AMBITION 1.6 102', 'OCTAVIA AMBITION 1.6 102'],
    ['skoda:octavia', 'AMBITION 1.4 TSI 140', 'OCTAVIA AMBITION 1.4 TSI 140'],
    ['skoda:octavia', 'CLASSIC 1.4 TSI 122', 'OCTAVIA CLASSIC 1.4 TSI (122)'],
    ['skoda:rapid', 'ACTIVE 1.2 75', 'RAPID ACTIVE 1.2 75'],
    ['skoda:rapid', 'AMBITION 1.2 75', 'RAPID AMBITION 1.2 75'],
    ['skoda:rapid', 'ELEGANCE 1.2 TSI 105', 'RAPID ELEGANCE 1.2 TSI 105'],
    ['skoda:rapid', 'AMBITION 1.4 TSI 122 DSG TIPTRONIC', 'RAPID AMBITION 1.4 TSI 122 DSG TIPTRONIC'],
    ['skoda:superb', 'ELEGANCE 1.8 TSI 160 TIPTRONIC', 'SUPERB ELEGANCE 1.8 TSI (160) TIPTRONIC'],
    ['skoda:superb', '2.0 TDI 150 DSG AMBITION', 'SUPERB 2.0 TDI 150 DSG AMBITION'],
  ])('keeps a cleaned but non-evidenced marketplace path in review for %s', (series, proposed, raw) => {
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
