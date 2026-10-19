import sharp from 'sharp'

const declaredMimeByFormat: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export class ListingImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ListingImageValidationError'
  }
}

export interface ProcessedListingImage {
  full: Buffer
  card: Buffer
  width: number
  height: number
}

export async function processListingImage(
  bytes: Buffer,
  declaredMimeType: string,
): Promise<ProcessedListingImage> {
  if (bytes.length === 0 || bytes.length > 8_000_000) {
    throw new ListingImageValidationError('Fotoğraf 8 MB veya daha küçük olmalı.')
  }

  try {
    const probe = sharp(bytes, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    })
    const metadata = await probe.metadata()
    const detectedMime = metadata.format ? declaredMimeByFormat[metadata.format] : undefined

    if (!detectedMime || detectedMime !== declaredMimeType) {
      throw new ListingImageValidationError('Fotoğraf formatı dosya içeriğiyle eşleşmiyor.')
    }

    const base = sharp(bytes, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    }).rotate()

    const fullResult = await base
      .clone()
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true })

    const card = await base
      .clone()
      .resize({
        width: 720,
        height: 540,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer()

    return {
      full: fullResult.data,
      card,
      width: fullResult.info.width,
      height: fullResult.info.height,
    }
  } catch (error) {
    if (error instanceof ListingImageValidationError) throw error
    throw new ListingImageValidationError('Geçerli bir JPG, PNG veya WebP fotoğraf yükle.')
  }
}
