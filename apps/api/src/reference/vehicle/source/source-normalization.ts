export function normalizeVehicleSourceText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function normalizeVehicleSourceIdentity(value: string): string {
  return normalizeVehicleSourceText(value)
    .replace(/\s*([/,-])\s*/g, '$1')
    .toLocaleUpperCase('tr-TR')
}

export function normalizeVehicleSourceYears(years: number[]): number[] {
  return [...new Set(years)].sort((a, b) => a - b)
}
