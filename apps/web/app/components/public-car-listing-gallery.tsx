'use client'

import { useState } from 'react'
import type { PublicCarListingDetailImage } from '../../lib/api-client'

interface PublicCarListingGalleryProps {
  images: PublicCarListingDetailImage[]
  title: string
}

export function PublicCarListingGallery({ images, title }: PublicCarListingGalleryProps) {
  const [activeImageId, setActiveImageId] = useState<string | null>(images[0]?.id ?? null)
  const activeImage = images.find((image) => image.id === activeImageId) ?? images[0]

  if (!activeImage) {
    return (
      <div className="listing-gallery listing-gallery-empty" role="img" aria-label="İlan fotoğrafı yok">
        <span>Fotoğraf bulunmuyor</span>
      </div>
    )
  }

  return (
    <div className="listing-gallery">
      <img
        className="listing-gallery-main"
        src={activeImage.fullUrl}
        alt={title}
      />

      {images.length > 1 && (
        <div className="listing-gallery-thumbs" aria-label="İlan fotoğrafları">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={image.id === activeImage.id ? 'is-active' : undefined}
              aria-label={`${index + 1}. fotoğrafı göster`}
              aria-pressed={image.id === activeImage.id}
              onClick={() => setActiveImageId(image.id)}
            >
              <img src={image.cardUrl} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
