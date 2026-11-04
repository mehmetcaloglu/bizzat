import { describe, expect, it } from 'vitest'
import type { CarSaleDraftResponse } from '../lib/api-client'
import {
  mergeDraftImages,
  normalizeTurkishPhone,
} from '../app/ilan-ver/otomobil/car-listing-form-state'

const listing = {
  id: 'listing-1',
  status: 'draft',
  type: 'car_sale',
  vehicle: {
    modelId: 'model-1',
    brand: { id: 'brand-1', name: 'Renault' },
    series: { id: 'series-1', name: 'Clio' },
    selectionPath: [{ key: 'model', name: 'Evolution' }],
  },
  details: null,
  title: 'Kullanıcının kaydedilmemiş yeni başlığı',
  attributes: null,
  contact: null,
  images: [],
} as CarSaleDraftResponse['listing']

describe('car listing form state', () => {
  it('updates only images and preserves dirty listing fields', () => {
    const images = [{
      id: 'image-1',
      url: '/api/v1/listings/listing-1/images/image-1',
      sortOrder: 0,
    }]

    const merged = mergeDraftImages(listing, images)

    expect(merged?.title).toBe('Kullanıcının kaydedilmemiş yeni başlığı')
    expect(merged?.vehicle).toBe(listing.vehicle)
    expect(merged?.details).toBe(listing.details)
    expect(merged?.images).toEqual(images)
  })

  it('normalizes common Turkish phone formats to E.164', () => {
    expect(normalizeTurkishPhone('0555 123 45 67')).toBe('+905551234567')
    expect(normalizeTurkishPhone('5551234567')).toBe('+905551234567')
    expect(normalizeTurkishPhone('+90 (555) 123-45-67')).toBe('+905551234567')
    expect(normalizeTurkishPhone('123')).toBeNull()
  })
})
