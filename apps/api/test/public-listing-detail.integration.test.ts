import { rm } from 'node:fs/promises'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { sql, type Kysely } from 'kysely'
import { createAuth, createAuthPool } from '../src/auth/auth.js'
import { migrateAuth } from '../src/auth/auth-migrator.js'
import { buildApp } from '../src/app.js'
import { checkDatabase } from '../src/db/check.js'
import { createDatabase, type Database } from '../src/db/client.js'
import { migrateBootstrap, migrateDomain } from '../src/db/migrator.js'
import type { NormalizedLocationSnapshot } from '../src/reference/import/location-import.types.js'
import { importLocationSnapshot } from '../src/reference/import/location-importer.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const mediaRoot = `/tmp/bizzat-public-listing-detail-media-${process.pid}`
process.env.BIZZAT_MEDIA_ROOT = mediaRoot

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)
const userIds: string[] = []
const listingIds: string[] = []
const modelIds: string[] = []
const seriesIds: string[] = []
const brandIds: string[] = []

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}

async function createSignedInUser(label: string) {
  const token = crypto.randomUUID().slice(0, 8)
  const email = `public-listing-detail-${Date.now()}-${token}@example.com`
  const password = 'correct-horse-battery-staple'

  const signUp = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: baseUrl, host: 'localhost:3000' },
    payload: { name: label, email, password },
  })
  expect(signUp.statusCode).toBe(200)
  const userId = signUp.json().user.id as string
  userIds.push(userId)

  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: baseUrl, host: 'localhost:3000' },
    payload: { email, password },
  })
  expect(signIn.statusCode).toBe(200)

  return { userId, cookie: cookieHeader(signIn.headers['set-cookie']) }
}

async function createCanonicalModel() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brandKey = `public-detail-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Public Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Public Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  seriesIds.push(series.id)

  const model = await db.insertInto('vehicle_models')
    .values({
      series_id: series.id,
      catalog_key: modelKey,
      name: '1.0 TCe Evolution',
      active: true,
      selection_path: JSON.stringify([
        { key: `${seriesKey}:1-0-tce`, name: '1.0 TCe' },
        { key: modelKey, name: 'Evolution' },
      ]),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  modelIds.push(model.id)
  return model.id
}

function locationSnapshot(code: string): NormalizedLocationSnapshot {
  return {
    provider: { code, sourceName: 'Public listing detail fixture', version: '1' },
    provinces: [
      { sourceKey: '34', code: '34', name: 'İstanbul' },
    ],
    districts: [
      { sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' },
    ],
    neighborhoods: [
      { sourceKey: '34-gungoren-haznedar', districtSourceKey: '34-gungoren', name: 'Haznedar', kind: 'mahalle' },
    ],
  }
}

async function createLocations() {
  const imported = await importLocationSnapshot(db, locationSnapshot(`public-detail-${crypto.randomUUID()}`))
  const result = await sql<{
    province_id: string
    district_id: string
    neighborhood_id: string
  }>`
    select p.id as province_id, d.id as district_id, n.id as neighborhood_id
    from provinces p
    join districts d on d.province_id = p.id
    join neighborhoods n on n.district_id = d.id
    where p.provider_id = ${imported.providerId}::uuid
  `.execute(db)

  const row = result.rows[0]
  if (!row) throw new Error('location fixture missing')
  return row
}

async function createDraft(cookie: string, vehicleModelId: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/listings/car-sale/drafts',
    headers: { cookie, host: 'localhost:3000' },
    payload: { vehicleModelId },
  })
  expect(response.statusCode).toBe(201)
  const id = response.json().listing.id as string
  listingIds.push(id)
  return id
}

const description = 'Bakımları zamanında yapılmış, günlük kullanılan temiz ve bireysel aile aracıdır.'

async function saveCompleteDetails(
  cookie: string,
  listingId: string,
  location: { province_id: string; district_id: string; neighborhood_id: string },
  showPhone = true,
) {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/v1/listings/${listingId}/car-sale/details`,
    headers: { cookie, host: 'localhost:3000' },
    payload: {
      modelYear: 2024,
      mileageKm: 42800,
      priceAmount: 1250000,
      provinceId: location.province_id,
      districtId: location.district_id,
      neighborhoodId: location.neighborhood_id,
      description,
      title: '2024 Renault Clio temiz aile aracı',
      fuelType: 'benzin',
      transmission: 'otomatik',
      vehicleCondition: 'second_hand',
      bodyType: 'hatchback',
      enginePowerHp: 90,
      engineDisplacementCc: 999,
      drivetrain: 'front',
      color: 'Beyaz',
      underWarranty: true,
      heavyDamageRecorded: false,
      plateNationality: 'tr',
      swapAvailable: false,
      paintStatus: 'original',
      replacementStatus: 'none',
      contactPhoneE164: '+905551234567',
      showPhone,
    },
  })
  expect(response.statusCode).toBe(200)
}

async function uploadPhoto(cookie: string, listingId: string): Promise<string> {
  const bytes = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: { r: 40, g: 120, b: 180 },
    },
  }).withMetadata({ orientation: 6 }).jpeg().toBuffer()

  const upload = await app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/images`,
    headers: {
      cookie,
      host: 'localhost:3000',
      'content-type': 'image/jpeg',
    },
    payload: bytes,
  })
  expect(upload.statusCode).toBe(201)
  return upload.json().listing.images[0].id as string
}

async function publishListing(listingId: string) {
  await db.updateTable('listings').set({ status: 'published' }).where('id', '=', listingId).execute()
}

async function createPublishedListing(options: { showPhone?: boolean } = {}) {
  const user = await createSignedInUser('Public Detail Owner')
  const modelId = await createCanonicalModel()
  const location = await createLocations()
  const listingId = await createDraft(user.cookie, modelId)
  await saveCompleteDetails(user.cookie, listingId, location, options.showPhone ?? true)
  const imageId = await uploadPhoto(user.cookie, listingId)
  await publishListing(listingId)
  return { user, listingId, imageId }
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  app = buildApp({
    logger: false,
    readinessCheck: () => checkDatabase(db),
    auth,
    authBaseUrl: baseUrl,
    db,
  })
})

afterEach(async () => {
  if (listingIds.length > 0) {
    await db.deleteFrom('car_details').where('listing_id', 'in', listingIds).execute()
    await db.deleteFrom('listings').where('id', 'in', listingIds.splice(0)).execute()
  }
  if (modelIds.length > 0) await db.deleteFrom('vehicle_models').where('id', 'in', modelIds.splice(0)).execute()
  if (seriesIds.length > 0) await db.deleteFrom('vehicle_series').where('id', 'in', seriesIds.splice(0)).execute()
  if (brandIds.length > 0) await db.deleteFrom('vehicle_brands').where('id', 'in', brandIds.splice(0)).execute()
})

afterAll(async () => {
  await app.close()
  await rm(mediaRoot, { recursive: true, force: true })
  await db.destroy()
  await authPool.end()
})

describe('public car listing detail', () => {
  it('returns a complete published listing without leaking the contact phone in the detail payload', async () => {
    const { listingId, imageId } = await createPublishedListing()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })

    expect(response.statusCode).toBe(200)
    const listing = response.json().listing
    expect(listing).toMatchObject({
      id: listingId,
      title: '2024 Renault Clio temiz aile aracı',
      description,
      priceAmount: 1250000,
      currency: 'TRY',
      modelYear: 2024,
      mileageKm: 42800,
      vehicle: {
        brandName: 'Renault Public Test',
        seriesName: 'Clio Public Test',
        modelName: '1.0 TCe Evolution',
        selectionPath: [
          { name: '1.0 TCe' },
          { name: 'Evolution' },
        ],
      },
      location: {
        provinceName: 'İstanbul',
        districtName: 'Güngören',
        neighborhoodName: 'Haznedar',
      },
      contact: {
        showPhone: true,
      },
      images: [
        {
          id: imageId,
          sortOrder: 0,
          cardUrl: `/api/v1/listings/public/images/${imageId}`,
          fullUrl: `/api/v1/listings/public/images/${imageId}/full`,
        },
      ],
    })
    expect(listing.attributes).toMatchObject({
      fuelType: 'benzin',
      transmission: 'otomatik',
      enginePowerHp: 90,
      engineDisplacementCc: 999,
    })
    expect(listing.contact.phoneE164).toBeUndefined()

    const contact = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}/contact`,
      headers: { host: 'localhost:3000' },
    })
    expect(contact.statusCode).toBe(200)
    expect(contact.json()).toEqual({ phoneE164: '+905551234567' })
  })

  it('does not expose the phone when the owner disables phone visibility', async () => {
    const { listingId } = await createPublishedListing({ showPhone: false })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().listing.contact).toEqual({ showPhone: false })

    const contact = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}/contact`,
      headers: { host: 'localhost:3000' },
    })
    expect(contact.statusCode).toBe(404)
    expect(contact.json().error.code).toBe('LISTING_CONTACT_NOT_AVAILABLE')
  })

  it('returns 404 for draft, incomplete, and unknown listings', async () => {
    const user = await createSignedInUser('Draft Detail Owner')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const draftId = await createDraft(user.cookie, modelId)
    await saveCompleteDetails(user.cookie, draftId, location)

    const draftResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${draftId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(draftResponse.statusCode).toBe(404)
    expect(draftResponse.json().error.code).toBe('LISTING_NOT_FOUND')

    const incompleteId = await createDraft(user.cookie, modelId)
    await publishListing(incompleteId)
    const incompleteResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${incompleteId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(incompleteResponse.statusCode).toBe(404)

    const unknownResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${crypto.randomUUID()}`,
      headers: { host: 'localhost:3000' },
    })
    expect(unknownResponse.statusCode).toBe(404)
  })

  it('serves sanitized card and full image variants only for published listings', async () => {
    const { user, imageId } = await createPublishedListing()

    const card = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/images/${imageId}`,
      headers: { host: 'localhost:3000' },
    })
    const full = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/images/${imageId}/full`,
      headers: { host: 'localhost:3000' },
    })

    expect(card.statusCode).toBe(200)
    expect(full.statusCode).toBe(200)
    expect(card.headers['content-type']).toContain('image/webp')
    expect(full.headers['content-type']).toContain('image/webp')

    const cardMetadata = await sharp(card.rawPayload).metadata()
    const fullMetadata = await sharp(full.rawPayload).metadata()
    expect(cardMetadata.format).toBe('webp')
    expect(fullMetadata.format).toBe('webp')
    expect(cardMetadata.exif).toBeUndefined()
    expect(fullMetadata.exif).toBeUndefined()
    expect(cardMetadata.width).toBeLessThanOrEqual(720)
    expect(cardMetadata.height).toBeLessThanOrEqual(540)
    expect(fullMetadata.width).toBeGreaterThan(cardMetadata.width ?? 0)
    expect(fullMetadata.height).toBeGreaterThan(cardMetadata.height ?? 0)

    const draftId = await createDraft(user.cookie, (await createCanonicalModel()))
    const draftImageId = await uploadPhoto(user.cookie, draftId)
    const draftCard = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/images/${draftImageId}`,
      headers: { host: 'localhost:3000' },
    })
    const draftFull = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/images/${draftImageId}/full`,
      headers: { host: 'localhost:3000' },
    })
    expect(draftCard.statusCode).toBe(404)
    expect(draftFull.statusCode).toBe(404)
  })
})
