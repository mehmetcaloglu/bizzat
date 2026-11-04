import type {
  CarSaleDraftResponse,
  ListingImageSummary,
} from '../../../lib/api-client'

type CarSaleDraft = CarSaleDraftResponse['listing']

export function mergeDraftImages(
  current: CarSaleDraft | null,
  images: ListingImageSummary[],
): CarSaleDraft | null {
  if (!current) return current
  return { ...current, images }
}

export function normalizeTurkishPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')

  if (digits.length === 12 && digits.startsWith('90')) {
    digits = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.length !== 10) return null
  return `+90${digits}`
}
