import { normalizeVehicleSourceIdentity } from '../source/source-normalization.js'

// Maintenance-only, fail-closed vocabulary. These rules NEVER normalize source
// identity for mapping confirmation. Unknown spelling/engine/body goes to review.
const TRIMS: Record<string, string> = {
  renault: 'Authentique|Authentique Edition|Business|Collection|Collection Limited Edition|Connect|Dynamique|Dynamique GT|Elegance|Equilibre|Esprit Alpine|Evolution|Evolution Plus|Executive|Expression|Extreme|Extreme Edition|GT|GT Line|Icon|Joy|Joy Comfort|Joy Plus|Night & Day|Outdoor|Panorama Edition|Play|Privilege|RS|RS Line|Sport Edition|Sport Emotion|Techno|Techno Esprit Alpine|Touch|Touch Plus',
  volkswagen: 'Allstar|BlueMotion|Business|Chrome Edition|Comfortline|Cup|Design|Elegance|Exclusive|Fan Edition|GTD|GTE|GTI|GTI Performance|Highline|Impression|Life|Lounge|Midline Plus|Primeline|Pro|Pulse|R|R-Line|SE|Sportline|Sportline Plus|Style|Trendline|White Edition|White Night',
  peugeot: 'Access|Active|Active Comfort Pack|Active Dynamic|Active Prime|Active Sky Pack|Active Sport Pack|Active Style|Allure|Allure Dynamic|Allure Elegance|Allure Selection|Allure Sport|Business|Classic Edition|Comfort|Evolution|Executive|Feline|GT|GT Dynamic|GT Line|GT Line Dynamic|GT Selection|GTI|Premium|Premium Pack|Premium Plus|Prime|Signature|Sportium|Style|Style Dynamic|Style Tech|Techno Edition|Trendy|Urban Move|Urban Soul',
  fiat: 'Active|Active Plus|Actual|Actual Plus|City|City Cross|Comfort|Cross|Cross Plus|Cult|Dolcevita|Dynamic|Dynamic Plus|Easy|Easy Plus|Easy Stil|Emotion|Emotion Plus|Limited|Lounge|Lounge Plus|Mirror|Mood|Opening Edition|Panoramic Edition|Pop|Pop Plus|Popstar|Rockstar|S-Design|Sport|Street|Street Plus|Urban|Urban Plus',
  bmw: 'Standart|Advantage|Business|Comfort|Comfort Plus|Dynamic|Edition Luxury Line|Edition M Sport|Edition Sport Line|Excellence|Exclusive|Executive|Executive Luxury|Executive Luxury Line|Executive M Sport|Executive Plus|Executive Prestige|Executive Sport|Executive Sport Line|First Edition Luxury Line|First Edition M Sport|First Edition Sport Line|Heritage|Joy|Joy Edition|Joy Plus|Lounge|Luxury|Luxury Line|Luxury Line Plus|Luxury Plus|M Excellence|M Joy|M Joy Plus|M Plus|M Sport|M Sport Edition|M Technic|Modern Line|Modern Line Plus|One Edition|Premium|Premium Line|Premium Line Plus|Prestige|Prestige Business|Pure|Pure Excellence|Pure Experience|Special Edition|Special Edition Luxury|Special Edition M Sport|Sport|Sport Edition|Sport Line|Sport Plus|Style|Techno Plus|Ultimate Luxury|Ultimate M Sport|Urban Line|Urban Plus|40th Year Edition|50 Jahre Edition|50th Year M Edition',
  'mercedes-benz': 'AMG|AMG Plus|Avantgarde|Avantgarde Sport|C-Edition|Classic|Comfort|Diamond Edition|Edition 1|Elegance|Exclusive|Fascination|Inspiration|Premium|Prime|Progressive|Selection|Selection Plus|Sport|Start|Style|Urban',
  audi: 'Advanced|Ambiente|Ambition|Attraction|Basic|Design|Design Line|Dynamic|Performance|Plus|S Line|Sport|Sport Line',
  toyota: 'Active|Advance|Comfort|Comfort Extra|Comfort Plus|Cool|Cool Konfor|Cool Konfor Plus|Cool Stil|Cool Stil Plus|Diamond|Diamond Navi|Diamond Premium|Dream|Dream X-Pack|Dynamic|Dynamic Navi|Dynamic Premium|Dynamic Techno|Elegant|Elegant Extra|Elegant Plus|Extra|Flame|Flame X-Pack|Fun|Fun Special|GR Sport|Life|Passion|Passion X-Pack|Passion X-Sport|Passion X-Style|Premium|Premium Navi|Premium Plus|Premium Plus Navi|Sol|Spirit|Spirit X-Trend|Sport|Style|Style Konfor|Style Konfor Plus|Style Red|Style Skypack|Style X-Trend|Terra Sporty|Touch|Vision|Vision Plus|X-Trend',
  citroen: 'Attraction|Chic|Collection|Confort|Confort Plus|Cool|Dynamique|E-Series|Easy|Elle|Exclusive|Executive|Feel|Feel Adventure|Feel Bold|Feel Bold Business|Feel Business|Feel S Edition|Feel Sx|Feel Sx Edition|Live|Live Business|Live Plus|Max|Plus|Selection|Shine|Shine Bold|Shine Business|Shine Exclusive|Shine Pack|Shine Rip Curl|Shine S Edition|Shine Sx Edition|So Chic|Start|You',
  dacia: 'Adventure|Ambiance|Ambiance New Age|Blackline|Comfort|Essential|Expression|Extreme|Laureate|Laureate New Age|Prestige|Prestige Plus|Techroad',
  ford: 'Active|Active Stil|Active X|Collection|Comfort|GT|Selective|ST|ST-Line|ST-Line X|Style|Titanium|Titanium Konfor|Titanium Stil|Titanium Tekno|Titanium X|Trend|Trend X|Vignale',
  honda: 'Black Edition|Comfort|Dream|Dynamic|Elegance|Elegance Navi|Elegance Plus|Elegance Smart|ES|ES Fun|EX Fun|Executive|Executive+|Executive Plus|Executive Smart|Executive Techno|Lifestyle|LS|LS Joy|Premium|RS|Sport|Type-R|Type-R GT',
  hyundai: 'Biz|Comfort|Elite|Elite Blue|Elite Bose|Elite Color Pack|Elite Panorama|Elite Plus|Elite Red Pack|Elite Smart|Executive|Go|Jump|Mode|Mode Plus|Prime|Prime Plus|Progressive|Select|Sense|Smart|Sports|Star|Style|Style Design Pack|Style Plus|Team|Tune|Vision',
  kia: 'Concept|Concept Plus|Cool|Elegance|Elegance Comfort|Executive|EX|Fancy|GT-Line|GSL|Lounge|LX|Motion|Prestige|Premium|Selection|Style|Comfort',
  nissan: 'Black Edition|Business|Design Pack|Design Pack Optima|Design Pack Premium|Intense|Match|Midnight Edition|N-Tec|Platinum|Platinum Premium|Platinum Premium Pack|Sky Pack|Special Edition|Sport Pack|Tekna|Tekna Premium Pack|Tekna Sky Pack|Tekna Sport Pack|Visia|Visia Alloy',
  opel: 'Active|Black Edition|Business|Color Edition|Cosmo|Design|Dynamic|Edition|Edition Plus|Elegance|Elite|Enjoy|Enjoy Active|Enjoy Black Edition|Enjoy Explorer|Enjoy Plus|Enjoy Skyline|Essentia|Essential|Excellence|Exclusive|Glam|GS|GS Line|GSi|Innovation|Jam|OPC|OPC Line Sport|Slam|Sport|Ultimate',
  seat: 'Copa|Copa Plus|Cupra|FR|Reference|Sport|Style|Style Plus|Style Visio|Xcellence|Xperience',
  skoda: 'Active|Ambiente|Ambiente Dinamik|Ambiente Optimal|Ambition|Ambition Optimal|Classic|Classic Plus|Comfort|Comfort Plus|Dinamik|Elegance|Elite|Experience|Monte Carlo|Optimal|Panorama|Premium|Prestige|RS|Scout|Sportline|Style',
  suzuki: 'GA|GL|GL+|GLS|GLX|GLX Premium|JLX|S|Sport|Style|Techno',
  subaru: 'Comfort|Elegance|Limited|Premium|Sport',
  chevrolet: 'Classic S|Classic SE|Classic SX|Design Edition|Design Edition Plus|LS|LS Plus|LT|LT Plus|LTZ|LTZ MyLink|SE|Sport|Sport Plus|WTCC Edition|WTCC Edition Plus',
  'alfa-romeo': 'City|Distinctive|Edizione Speciale|Estrema|Lusso|Progression|Progression Plus|Speciale|Sprint|Super|Ti|Veloce',
  mazda: 'Impressive|Motion|Power|Power Sense|Reflex|Sport|Touring',
  mitsubishi: 'Invite|Intense|Instyle|Inform|Insport',
}
const trimNames = new Map(Object.entries(TRIMS).map(([brand, values]) => [brand,
  new Map(values.split('|').map((value) => [normalizeVehicleSourceIdentity(value), value])),
]))
const ENGINE_SPELLING: Record<string, string> = {
  TCE: 'TCe', SCE: 'SCe', DCI: 'dCi', BLUEDCI: 'BlueDCI', TSI: 'TSI', ETSI: 'eTSI', TDI: 'TDI', TFSI: 'TFSI', FSI: 'FSI',
  HDI: 'HDi', 'E-HDI': 'e-HDi', BLUEHDI: 'BlueHDi', PURETECH: 'PureTech', VTI: 'VTi', THP: 'THP', FIRE: 'Fire', FIREFLY: 'FireFly',
  MULTIJET: 'Multijet', 'T-JET': 'T-Jet', 'E-TORQ': 'E-Torq', 'T4 HYBRID': 'T4 Hybrid', MPI: 'MPI',
  'D-4D': 'D-4D', 'I-DTEC': 'i-DTEC', 'I-VTEC': 'i-VTEC', VTEC: 'VTEC', CRDI: 'CRDi', GDI: 'GDi', 'T-GDI': 'T-GDi',
  TDCI: 'TDCi', ECOBOOST: 'EcoBoost', ECOTEC: 'Ecotec', CDI: 'CDI', CGI: 'CGI', HYBRID: 'Hybrid',
}
const TECHNICAL = [
  /\b(?:X-?TRONIC|S[ -]?TRONIC|MULTITRONIC|TIPTRONIC|GEARTRONIC|STEPTRONIC|POWERSHIFT|MULTIDRIVE S|M\/M)\b/g,
  /\b(?:DSG|EDC|DCT|CVT|ECVT|E-CVT|EAT[68]|EDCS6|AUTO6R|ETG[56]|BMP6|AMT|MTA|MMT|OV|OTM|OTOMATIK|MANUEL|MANUAL|AT[468]?|MT[56]?|[56789]G[ -]TRONIC(?: PLUS)?)\b/g,
  /\b(?:FAZ ?[12]|PHASE ?[12]|EURO ?[456](?:D|B)?|E[456](?:D(?:-?TEMP)?|B)?\+?|[168]+V|LCI|FL|PI|BMT|GSR|S&S|S& S)\b/g,
  /\b\d+(?:[.,]\d+)?\s*(?:KW|HP|PS|BG|BEYGIR)\b/g,
]

interface SeriesNormalizationPolicy {
  defaultBody?: RegExp
}

// Every entry is a reviewed marketplace series policy. Do not derive this list
// from aliases: an absent series must retain body/technical/power tokens and
// fail the exact trim lookup instead of being silently consolidated.
const SERIES_NORMALIZATION_POLICIES: Record<string, SeriesNormalizationPolicy> = {
  'renault:clio': { defaultBody: /\b(?:HB|HATCHBACK)\b/g },
  'volkswagen:polo': { defaultBody: /\b(?:HB|HATCHBACK)\b/g },
  'volkswagen:golf': { defaultBody: /\b(?:HB|HATCHBACK)\b/g },
  'peugeot:308': { defaultBody: /\b(?:5 ?KAPI|HB|HATCHBACK)\b/g },
  'fiat:egea': { defaultBody: /\bSEDAN\b/g },
  'toyota:corolla': { defaultBody: /\bSEDAN\b/g },
  'bmw:3-serisi': { defaultBody: /\bSEDAN\b/g },
  'mercedes-benz:c-serisi': { defaultBody: /\b(?:SEDAN|LIMOUSINE)\b/g },
  'audi:a3': {},
  'audi:a4': {},
}

export interface ModelSelection { path: string[]; name: string }
function selection(path: string[]): ModelSelection { return { path, name: path.join(' ') } }

function stripFollowingPower(value: string): string {
  return value.replace(
    /^\s+(?:\(\s*\d{2,3}\s*\)|\d{2,3}\b(?![.,]\s*(?:YEAR|YIL)|\s+(?:YEAR|YIL|JAHRE)))/,
    ' ',
  )
}

function stripDisplacement(value: string): string {
  // A bare power figure is recognized only immediately after displacement.
  // Numbers elsewhere can be edition names and must survive for exact review.
  return value.replace(
    /\b\d\.\d{1,2}\b(?:\s+(?:\(\s*\d{2,3}\s*\)|\d{2,3}\b(?![.,]\s*(?:YEAR|YIL)|\s+(?:YEAR|YIL|JAHRE))))?/g,
    ' ',
  )
}


export function canonicalModelSelection(seriesKey: string, proposed: string, typeRaw: string): ModelSelection | null {
  const brand = seriesKey.split(':')[0]!
  let label = normalizeVehicleSourceIdentity(proposed)
  const raw = normalizeVehicleSourceIdentity(typeRaw)
  const policy = SERIES_NORMALIZATION_POLICIES[seriesKey]
  // Known source labels only; no inference of battery/trim from kW or model year.
  if (brand === 'tesla') {
    if (seriesKey === 'tesla:model-3') {
      const names: Record<string, string> = { 'LONG RANGE': 'Long Range', PERFORMANCE: 'Performance', 'STANDART RANGE': 'Standart' }
      return names[label] ? selection([names[label]!]) : null
    }
    return null
  }
  if (!trimNames.has(brand)) return null
  // These source aliases historically folded different nameplates into one.
  if (seriesKey === 'fiat:egea' && /\bCROSS\b/.test(raw)) return null

  let group = ''
  let body = ''
  if (brand === 'bmw') {
    const badge = raw.match(/^(M?\d{3}(?:LD|LI|LE|TI|IS|D|I|E))\b/)
    if (!badge) return null
    group = badge[1]!.replace(/[A-Z]+$/, (s) => s.toLowerCase())
    label = policy ? stripDisplacement(raw.slice(badge[0].length)) : raw.slice(badge[0].length)
    if (seriesKey === 'bmw:3-serisi') {
      if (/\bED\b/.test(label)) { group += ' ED'; label = label.replace(/\bED\b/, ' ') }
      const shape = label.match(/\b(TOURING|GRAN TURISMO|GRAN COUPE|COUPE|CABRIOLET)\b/)
      if (shape) { body = shape[0].toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase()); label = label.replace(shape[0], ' ') }
    }
    // Drivetrain sometimes IS a marketplace branch. Never silently collapse it.
    if (/\b(?:XDRIVE|SDRIVE)\b/.test(label)) return null
  } else if (brand === 'mercedes-benz') {
    const badge = raw.match(/^([A-Z]{1,3})\s?(\d{2,3})(?:\s?(D|K))?\b/)
    if (!badge) return null
    group = `${badge[1]} ${badge[2]}${badge[3] === 'D' ? ' d' : badge[3] === 'K' ? ' Komp.' : ''}`
    label = policy ? stripDisplacement(raw.slice(badge[0].length)) : raw.slice(badge[0].length)
    if (seriesKey === 'mercedes-benz:c-serisi') {
      const blue = label.match(/\b(?:BLUEEFFICIENCY|BLUEEFICIENCY|BLUEFFICIENCY)\b/)
      if (blue) { group += ' BlueEfficiency'; label = label.replace(blue[0], ' ') }
    }
  } else if (brand === 'audi') {
    if (!['audi:a3', 'audi:a4'].includes(seriesKey)) return null
    const shape = label.match(/\b(SEDAN|SPORTBACK|AVANT)\b/)
    if (!shape) return null // Missing body is not evidence of Sedan.
    body = `${seriesKey.split(':')[1]!.toUpperCase()} ${shape[0][0]}${shape[0].slice(1).toLowerCase()}`
    label = label.replace(shape[0], ' ')
    for (const pattern of TECHNICAL) label = label.replace(pattern, ' ')
    const badge = label.match(/\b(\d{2}) (TFSI|TDI)\b/)
    if (badge) {
      group = badge[0]
      label = stripDisplacement(`${label.slice(0, badge.index)} ${stripFollowingPower(label.slice(badge.index! + badge[0].length))}`)
    }
  } else if (seriesKey === 'renault:clio') {
    const shape = label.match(/\b(SPORT ?TOURER|GRAND ?TOUR|G\.TOUR)\b/)
    if (shape) { body = shape[0].startsWith('SPORT') ? 'Sport Tourer' : 'Grandtour'; label = label.replace(shape[0], ' ') }
  }
  if (policy?.defaultBody) label = label.replace(policy.defaultBody, ' ')
  if (seriesKey === 'bmw:3-serisi' || seriesKey === 'mercedes-benz:c-serisi') {
    label = stripFollowingPower(label)
  }
  label = label.replace(/\bBLUE HDI\b/g, 'BLUEHDI').replace(/\bBLUE DCI\b/g, 'BLUEDCI')
    .replace(/\bM\.JET\b/g, 'MULTIJET').replace(/\bHIBRIT\b/g, 'HYBRID').replace(/\bE-TSI\b/g, 'ETSI')
  if (policy) {
    for (const pattern of TECHNICAL) label = label.replace(pattern, ' ')
  }
  const technologies = Object.keys(ENGINE_SPELLING).sort((a, b) => b.length - a.length).join('|')
  const engine = label.match(new RegExp(`\\b(\\d\\.\\d{1,2})\\s*(${technologies})?\\b`))
  if (!group && engine) {
    group = `${engine[1]}${engine[2] ? ` ${ENGINE_SPELLING[engine[2]]}` : ''}`
    const engineEnd = engine.index! + engine[0].length
    const tail = policy ? stripFollowingPower(label.slice(engineEnd)) : label.slice(engineEnd)
    label = `${label.slice(0, engine.index)} ${tail}`
  }
  if (!group) return null
  label = label.replace(/\s+/g, ' ').trim()
  // Reviewed punctuation-only aliases; unknown typos are not guessed.
  if (brand === 'peugeot' || brand === 'renault') label = label.replace(/^GT-LINE\b/, 'GT LINE')
  if (seriesKey === 'bmw:3-serisi' && !label) label = 'STANDART' // Real BMW marketplace leaf.
  const trim = trimNames.get(brand)!.get(label)
  if (!trim) return null
  const path = brand === 'audi' ? [body, group, trim] : [`${group}${body ? ` ${body}` : ''}`, trim]
  return selection(path)
}
