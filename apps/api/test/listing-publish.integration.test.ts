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
import {
  createVerificationProvider,
  UnavailableVerificationProvider,
  type VerificationProvider,
} from '../src/modules/verifications/verification.provider.js'
import type { NormalizedLocationSnapshot } from '../src/reference/import/location-import.types.js'
import { importLocationSnapshot } from '../src/reference/import/location-importer.js'

process.env.EIDS_PROVIDER = 'mock'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')
const secret = process.env.BETTER_AUTH_SECRET ?? 'bizzat-test-auth-secret-00000000000001'
const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const mediaRoot = `/tmp/bizzat-listing-publish-media-${process.pid}`
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
  const email = `listing-publish-${Date.now()}-${token}@example.com`
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
  const brandKey = `publish-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Publish Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Publish Test', active: true })
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
    provider: { code, sourceName: 'Listing publish fixture', version: '1' },
    provinces: [{ sourceKey: '34', code: '34', name: 'İstanbul' }],
    districts: [{ sourceKey: '34-gungoren', provinceSourceKey: '34', name: 'Güngören' }],
    neighborhoods: [{
      sourceKey: '34-gungoren-haznedar',
      districtSourceKey: '34-gungoren',
      name: 'Haznedar',
      kind: 'mahalle',
    }],
  }
}

async function createLocations() {
  const imported = await importLocationSnapshot(db, locationSnapshot(`publish-${crypto.randomUUID()}`))
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
      showPhone: true,
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
  }).jpeg().toBuffer()

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

async function createCompleteDraft() {
  const user = await createSignedInUser('Publish Owner')
  const modelId = await createCanonicalModel()
  const location = await createLocations()
  const listingId = await createDraft(user.cookie, modelId)
  await saveCompleteDetails(user.cookie, listingId, location)
  await uploadPhoto(user.cookie, listingId)
  return { user, listingId, modelId, location }
}

function buildTestApp(verificationProvider?: VerificationProvider) {
  return buildApp({
    logger: false,
    readinessCheck: () => checkDatabase(db),
    auth,
    authBaseUrl: baseUrl,
    db,
    ...(verificationProvider ? { verificationProvider } : {}),
  })
}

beforeAll(async () => {
  db = createDatabase(databaseUrl)
  await migrateBootstrap(db)
  await migrateAuth(auth)
  await migrateDomain(db)
  app = buildTestApp()
})

afterEach(async () => {
  if (listingIds.length > 0) {
    await db.deleteFrom('car_details').where('listing_id', 'in', listingIds).execute()
    await db.deleteFrom('listings').where('id', 'in', listingIds.splice(0)).execute()
  }
  if (modelIds.length > 0) await db.deleteFrom('vehicle_models').where('id', 'in', modelIds.splice(0)).execute()
  if (seriesIds.length > 0) await db.deleteFrom('vehicle_series').where('id', 'in', seriesIds.splice(0)).execute()
  if (brandIds.length > 0) await db.deleteFrom('vehicle_brands').where('id', 'in', brandIds.splice(0)).execute()
  for (const userId of userIds.splice(0)) {
    await sql`delete from auth."user" where id = ${userId}::uuid`.execute(db)
  }
})

afterAll(async () => {
  await app.close()
  await rm(mediaRoot, { recursive: true, force: true })
  await db.destroy()
  await authPool.end()
})

describe('listing publish and owner management', () => {
  it('publishes a complete draft and exposes it to the public feed and own listings', async () => {
    const { user, listingId } = await createCompleteDraft()

    const publish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })

    expect(publish.statusCode).toBe(200)
    const published = publish.json().listing
    expect(published.status).toBe('published')
    expect(typeof published.publishedAt).toBe('string')

    const persisted = await sql<{
      status: string
      published_at: Date | null
    }>`
      select status, published_at from listings where id = ${listingId}::uuid
    `.execute(db)
    expect(persisted.rows[0]?.status).toBe('published')
    expect(persisted.rows[0]?.published_at).not.toBeNull()

    const checks = await sql<{
      status: string
      provider: string
      provider_reference: string | null
      verified_at: Date | null
    }>`
      select status, provider, provider_reference, verified_at
      from verification_checks
      where listing_id = ${listingId}::uuid
      order by created_at desc
    `.execute(db)
    expect(checks.rows).toHaveLength(1)
    expect(checks.rows[0]).toMatchObject({
      status: 'verified',
      provider: 'mock',
      provider_reference: `mock:${listingId}`,
    })
    expect(checks.rows[0]?.verified_at).not.toBeNull()

    const ownListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(ownListings.statusCode).toBe(200)
    const ownItem = ownListings.json().items.find((item: { id: string }) => item.id === listingId)
    expect(ownItem).toMatchObject({
      id: listingId,
      status: 'published',
      title: '2024 Renault Clio temiz aile aracı',
      priceAmount: 1250000,
      currency: 'TRY',
    })
    expect(ownItem.imageUrl).toBeTruthy()
    expect(ownItem.publishedAt).toBeTruthy()

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(200)
  })

  it('rejects incomplete drafts and drafts without a photo', async () => {
    const user = await createSignedInUser('Incomplete Publish Owner')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const incompleteId = await createDraft(user.cookie, modelId)

    const incomplete = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${incompleteId}/publish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(incomplete.statusCode).toBe(409)
    expect(incomplete.json().error.code).toBe('LISTING_INCOMPLETE')

    const noPhotoId = await createDraft(user.cookie, modelId)
    await saveCompleteDetails(user.cookie, noPhotoId, location)
    const noPhoto = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${noPhotoId}/publish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(noPhoto.statusCode).toBe(409)
    expect(noPhoto.json().error.code).toBe('LISTING_INCOMPLETE')

    const statuses = await sql<{ id: string; status: string }>`
      select id, status from listings where id in (${incompleteId}::uuid, ${noPhotoId}::uuid)
    `.execute(db)
    expect(statuses.rows.every((row) => row.status === 'draft')).toBe(true)
    expect((await sql`select id from verification_checks where listing_id = ${incompleteId}::uuid`.execute(db)).rows).toHaveLength(0)
  })

  it('unpublishes and republishes a listing while keeping public reads consistent', async () => {
    const { user, listingId } = await createCompleteDraft()
    await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })

    const unpublish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/unpublish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(unpublish.statusCode).toBe(200)
    expect(unpublish.json().listing.status).toBe('inactive')

    const hidden = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(hidden.statusCode).toBe(404)

    const ownListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(ownListings.json().items.find((item: { id: string }) => item.id === listingId)).toMatchObject({
      status: 'inactive',
    })

    const beforeRepublish = await sql<{ published_at: Date | null }>`
      select published_at from listings where id = ${listingId}::uuid
    `.execute(db)
    expect(beforeRepublish.rows[0]?.published_at).not.toBeNull()

    const republish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(republish.statusCode).toBe(200)
    expect(republish.json().listing.status).toBe('published')

    const visible = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(visible.statusCode).toBe(200)
  })

  it('requires authentication and enforces listing ownership', async () => {
    const owner = await createSignedInUser('Real Owner')
    const other = await createSignedInUser('Other Owner')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createDraft(owner.cookie, modelId)
    await saveCompleteDetails(owner.cookie, listingId, location)
    await uploadPhoto(owner.cookie, listingId)

    const noSession = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { host: 'localhost:3000' },
    })
    expect(noSession.statusCode).toBe(401)

    const foreignPublish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: other.cookie, host: 'localhost:3000' },
    })
    expect(foreignPublish.statusCode).toBe(404)

    const otherListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: other.cookie, host: 'localhost:3000' },
    })
    expect(otherListings.statusCode).toBe(200)
    expect(otherListings.json().items).toHaveLength(0)
  })

  it('fails closed and keeps the listing in draft when verification is unavailable', async () => {
    const { user, listingId } = await createCompleteDraft()
    const unavailableApp = buildTestApp(new UnavailableVerificationProvider())

    try {
      const publish = await unavailableApp.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/publish`,
        headers: { cookie: user.cookie, host: 'localhost:3000' },
      })
      expect(publish.statusCode).toBe(503)
      expect(publish.json().error.code).toBe('DEPENDENCY_UNAVAILABLE')
    } finally {
      await unavailableApp.close()
    }

    const persisted = await sql<{ status: string }>`
      select status from listings where id = ${listingId}::uuid
    `.execute(db)
    expect(persisted.rows[0]?.status).toBe('draft')

    const checks = await sql<{ status: string; failure_code: string | null }>`
      select status, failure_code from verification_checks where listing_id = ${listingId}::uuid
    `.execute(db)
    expect(checks.rows[0]).toMatchObject({
      status: 'unavailable',
      failure_code: 'EIDS_PROVIDER_NOT_CONFIGURED',
    })

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(404)
  })

  it('keeps the listing in draft when EİDS authority verification fails', async () => {
    const { user, listingId } = await createCompleteDraft()
    const failingProvider: VerificationProvider = {
      name: 'failing',
      async verifyVehicleAuthority() {
        return { status: 'failed', failureCode: 'EIDS_AUTHORITY_MISMATCH' }
      },
    }
    const failingApp = buildTestApp(failingProvider)

    try {
      const publish = await failingApp.inject({
        method: 'POST',
        url: `/api/v1/listings/${listingId}/publish`,
        headers: { cookie: user.cookie, host: 'localhost:3000' },
      })
      expect(publish.statusCode).toBe(409)
      expect(publish.json().error.code).toBe('VERIFICATION_FAILED')
    } finally {
      await failingApp.close()
    }

    const persisted = await sql<{ status: string }>`
      select status from listings where id = ${listingId}::uuid
    `.execute(db)
    expect(persisted.rows[0]?.status).toBe('draft')

    const checks = await sql<{ status: string; failure_code: string | null }>`
      select status, failure_code from verification_checks where listing_id = ${listingId}::uuid
    `.execute(db)
    expect(checks.rows[0]).toMatchObject({
      status: 'failed',
      failure_code: 'EIDS_AUTHORITY_MISMATCH',
    })
  })

  it('refuses a mock EİDS provider in production configuration', () => {
    expect(() => createVerificationProvider({
      NODE_ENV: 'production',
      EIDS_PROVIDER: 'mock',
    })).toThrow('Mock EIDS verification provider is not allowed in production.')

    expect(createVerificationProvider({ NODE_ENV: 'production' }).name).toBe('unconfigured')
  })
})
