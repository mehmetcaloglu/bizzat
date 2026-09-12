const REVIEWED_SOURCE_KEYS: Record<string, ReadonlySet<string>> = {
  'seat:ibiza': new Set([
    '19-245',
    '19-1035',
    '19-1097',
    '19-1103',
    '19-1124',
    '19-1140',
    '19-1153',
  ]),
  'renault:megane': new Set([
    '122-1088',
    '122-1089',
    '122-1105',
    '122-1106',
    '122-1107',
    '122-1108',
    '122-1160',
    '122-1161',
  ]),
  'ford:focus': new Set([
    '53-2120',
    '53-2123',
    '53-2126',
    '53-2196',
    '53-2251',
    '53-2254',
  ]),
  'opel:astra': new Set([
    '111-715',
    '111-716',
    '111-717',
    '111-1011',
  ]),
}

export function isSourceCodeReviewedForSelection(seriesKey: string, sourceKey: string): boolean {
  const reviewed = REVIEWED_SOURCE_KEYS[seriesKey]
  return reviewed === undefined || reviewed.has(sourceKey)
}
