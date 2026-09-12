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
  'skoda:octavia': new Set([
    '133-1017',
    '133-1021',
    '133-1045',
    '133-1047',
    '133-1051',
    '133-1168',
    '133-1169',
    '133-1170',
    '133-1171',
    '133-1249',
    '133-1329',
    '133-283',
    '133-376',
    '133-378',
    '133-380',
    '133-433',
  ]),
  'skoda:fabia': new Set([
    '133-1253',
    '133-1285',
    '133-1286',
    '133-1287',
    '133-1312',
    '133-341',
    '133-345',
    '133-346',
  ]),
  'skoda:rapid': new Set([
    '133-1040',
    '133-1043',
  ]),
  'skoda:superb': new Set([
    '133-1026',
    '133-1147',
    '133-365',
    '133-371',
  ]),
}

export function isSourceCodeReviewedForSelection(seriesKey: string, sourceKey: string): boolean {
  const reviewed = REVIEWED_SOURCE_KEYS[seriesKey]
  return reviewed === undefined || reviewed.has(sourceKey)
}
