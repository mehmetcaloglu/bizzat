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
  const email = `listing-report-${Date.now()}-${token}@example.com`
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

async function makeModerator(cookie: string, userId: string) {
  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { cookie, host: 'localhost:3000' },
  })
  expect(me.statusCode).toBe(200)
  await db.updateTable('profiles').set({ role: 'moderator' }).where('user_id', '=', userId).execute()
}

async function createCanonicalModel() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brandKey = `report-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Report Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Report Test', active: true })
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
    provider: { code, sourceName: 'Listing report fixture', version: '1' },
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
  const imported = await importLocationSnapshot(db, locationSnapshot(`report-${crypto.randomUUID()}`))
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

async function createListing(
  ownerUserId: string,
  modelId: string,
  location: { province_id: string; district_id: string; neighborhood_id: string },
  status: 'draft' | 'published',
) {
  const carSale = await db
    .selectFrom('listing_types')
    .select('id')
    .where('code', '=', 'car_sale')
    .executeTakeFirstOrThrow()

  const listing = await db.insertInto('listings')
    .values({
      owner_user_id: ownerUserId,
      listing_type_id: carSale.id,
      status,
      title: '2024 Renault Clio rapor testi ilanı',
      description: 'Raporlama ve moderasyon testi için hazırlanmış bireysel otomobil ilanı.',
      price_amount: '1250000',
      currency: 'TRY',
      province_id: location.province_id,
      district_id: location.district_id,
      neighborhood_id: location.neighborhood_id,
      contact_phone_e164: '+905551234567',
      show_phone: true,
      published_at: status === 'published' ? new Date() : null,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  listingIds.push(listing.id)

  await db.insertInto('car_details').values({
    listing_id: listing.id,
    vehicle_model_id: modelId,
    model_year: 2024,
    mileage_km: 42800,
    fuel_type: 'benzin',
    transmission: 'otomatik',
    body_type: 'hatchback',
    vehicle_condition: 'second_hand',
    engine_power_hp: 90,
    engine_displacement_cc: 999,
    drivetrain: 'front',
    color: 'Beyaz',
    under_warranty: true,
    heavy_damage_recorded: false,
    plate_nationality: 'tr',
    swap_available: false,
    paint_status: 'original',
    replacement_status: 'none',
  }).execute()

  const imageId = crypto.randomUUID()
  await db.insertInto('listing_images').values({
    id: imageId,
    listing_id: listing.id,
    storage_key: `private/${listing.id}/${imageId}/full.webp`,
    card_storage_key: `private/${listing.id}/${imageId}/card.webp`,
    sort_order: 0,
    mime_type: 'image/webp',
    size_bytes: 1000,
    width: 1200,
    height: 900,
  }).execute()

  return listing.id
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
  for (const userId of userIds.splice(0)) {
    await sql`delete from auth."user" where id = ${userId}::uuid`.execute(db)
  }
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
})

describe('listing reports and moderation', () => {
  it('accepts anonymous reports and shows them to moderators only', async () => {
    const owner = await createSignedInUser('Report Owner')
    const moderator = await createSignedInUser('Moderator')
    const reporter = await createSignedInUser('Reporter')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location, 'published')

    const report = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: {
        reason: 'fraud',
        note: 'Fiyat ve açıklama şüpheli görünüyor.',
      },
    })
    expect(report.statusCode).toBe(201)
    expect(report.headers['cache-control']).toBe('no-store')
    expect(report.json().report).toMatchObject({ status: 'open' })
    expect(typeof report.json().report.id).toBe('string')
    expect(typeof report.json().report.createdAt).toBe('string')

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: {
        reason: 'misleading',
        note: 'Aynı ilan için tekrar rapor.',
      },
    })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('REPORT_ALREADY_OPEN')

    const persisted = await sql<{
      reporter_user_id: string | null
      reason: string
      note: string | null
      status: string
    }>`
      select reporter_user_id, reason, note, status
      from reports where listing_id = ${listingId}::uuid
    `.execute(db)
    expect(persisted.rows[0]).toMatchObject({
      reporter_user_id: null,
      reason: 'fraud',
      note: 'Fiyat ve açıklama şüpheli görünüyor.',
      status: 'open',
    })

    const guestList = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/reports',
      headers: { host: 'localhost:3000' },
    })
    expect(guestList.statusCode).toBe(401)

    const memberList = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/reports',
      headers: { cookie: reporter.cookie, host: 'localhost:3000' },
    })
    expect(memberList.statusCode).toBe(403)
    expect(memberList.json().error.code).toBe('FORBIDDEN')

    const moderators = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/reports',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(moderators.statusCode).toBe(200)
    expect(moderators.headers['cache-control']).toBe('no-store')
    expect(moderators.json().items).toHaveLength(1)
    expect(moderators.json().items[0]).toMatchObject({
      listingId,
      reason: 'fraud',
      reporterType: 'guest',
      status: 'open',
    })
    expect(moderators.json().items[0].listing.title).toBe('2024 Renault Clio rapor testi ilanı')
    expect(moderators.json().items[0].listing.imageUrl).toContain('/api/v1/listings/public/images/')
  })

  it('lets a moderator reject a reported listing and resolve all open reports', async () => {
    const owner = await createSignedInUser('Moderated Owner')
    const moderator = await createSignedInUser('Acting Moderator')
    const member = await createSignedInUser('Member Reporter')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location, 'published')

    const guestReport = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'prohibited', note: 'Uygunsuz içerik.' },
    })
    expect(guestReport.statusCode).toBe(201)

    const memberReport = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/reports`,
      headers: { cookie: member.cookie, host: 'localhost:3000' },
      payload: { reason: 'misleading', note: 'Fotoğraflar araçla uyuşmuyor.' },
    })
    expect(memberReport.statusCode).toBe(201)
    expect(memberReport.json().report.status).toBe('open')

    const resolve = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${guestReport.json().report.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: {
        action: 'reject',
        note: 'İlan inceleme sonucunda yayından kaldırıldı.',
      },
    })
    expect(resolve.statusCode).toBe(200)
    expect(resolve.json().report).toMatchObject({ status: 'resolved' })
    expect(typeof resolve.json().report.reviewedAt).toBe('string')

    const listing = await db
      .selectFrom('listings')
      .select('status')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow()
    expect(listing.status).toBe('rejected')

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(404)

    const republish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/publish`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(republish.statusCode).toBe(409)
    expect(republish.json().error.code).toBe('LISTING_NOT_EDITABLE')

    const reports = await sql<{
      status: string
      reviewed_by_user_id: string | null
      resolution_note: string | null
      reviewed_at: Date | null
    }>`
      select status, reviewed_by_user_id, resolution_note, reviewed_at
      from reports where listing_id = ${listingId}::uuid
      order by created_at asc
    `.execute(db)
    expect(reports.rows).toHaveLength(2)
    expect(reports.rows.every((row) => row.status === 'resolved')).toBe(true)
    expect(reports.rows.every((row) => row.reviewed_by_user_id === moderator.userId)).toBe(true)
    expect(reports.rows.every((row) => row.resolution_note === 'İlan inceleme sonucunda yayından kaldırıldı.')).toBe(true)
    expect(reports.rows.every((row) => row.reviewed_at !== null)).toBe(true)

    const openReports = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/reports',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(openReports.json().items).toHaveLength(0)
  })

  it('lets a moderator dismiss a report without changing the listing', async () => {
    const owner = await createSignedInUser('Dismiss Owner')
    const moderator = await createSignedInUser('Dismiss Moderator')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location, 'published')

    const report = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'other' },
    })
    expect(report.statusCode).toBe(201)

    const dismiss = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${report.json().report.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'dismiss', note: 'Rapor incelendi, işlem gerekmedi.' },
    })
    expect(dismiss.statusCode).toBe(200)
    expect(dismiss.json().report.status).toBe('dismissed')

    const listing = await db
      .selectFrom('listings')
      .select('status')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow()
    expect(listing.status).toBe('published')

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(200)
  })

  it('rate limits guest reports per hashed IP address', async () => {
    const owner = await createSignedInUser('Rate Limit Owner')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const ids = []
    for (let index = 0; index < 6; index += 1) {
      ids.push(await createListing(owner.userId, modelId, location, 'published'))
    }

    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/listings/${ids[index]}/reports`,
        headers: { host: 'localhost:3000' },
        payload: { reason: 'other', note: `Guest raporu ${index + 1}` },
      })
      expect(response.statusCode).toBe(201)
    }

    const limited = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${ids[5]}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'other', note: 'Limit sonrası rapor.' },
    })
    expect(limited.statusCode).toBe(429)
    expect(limited.json().error.code).toBe('RATE_LIMITED')

    const stored = await sql<{ reporter_ip_hash: string | null }>`
      select reporter_ip_hash from reports where listing_id = ${ids[0]}::uuid
    `.execute(db)
    expect(stored.rows[0]?.reporter_ip_hash).toHaveLength(64)
    expect(stored.rows[0]?.reporter_ip_hash).not.toBe('127.0.0.1')
  })

  it('rate limits member reports per user', async () => {
    const owner = await createSignedInUser('Member Rate Owner')
    const reporter = await createSignedInUser('Member Rate Reporter')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const ids = []
    for (let index = 0; index < 11; index += 1) {
      ids.push(await createListing(owner.userId, modelId, location, 'published'))
    }

    for (let index = 0; index < 10; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/listings/${ids[index]}/reports`,
        headers: { cookie: reporter.cookie, host: 'localhost:3000' },
        payload: { reason: 'other', note: `Üye raporu ${index + 1}` },
      })
      expect(response.statusCode).toBe(201)
    }

    const limited = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${ids[10]}/reports`,
      headers: { cookie: reporter.cookie, host: 'localhost:3000' },
      payload: { reason: 'other', note: 'Limit sonrası üye raporu.' },
    })
    expect(limited.statusCode).toBe(429)
    expect(limited.json().error.code).toBe('RATE_LIMITED')
  })

  it('rejects reports for non-public listings, own listings, and already reviewed reports', async () => {
    const owner = await createSignedInUser('Validation Owner')
    const moderator = await createSignedInUser('Validation Moderator')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const draftId = await createListing(owner.userId, modelId, location, 'draft')
    const publishedId = await createListing(owner.userId, modelId, location, 'published')

    const draftReport = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${draftId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'fraud' },
    })
    expect(draftReport.statusCode).toBe(404)

    const ownReport = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/reports`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: { reason: 'fraud' },
    })
    expect(ownReport.statusCode).toBe(400)
    expect(ownReport.json().error.code).toBe('VALIDATION_ERROR')

    const invalidReason = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'not-a-real-reason' },
    })
    expect(invalidReason.statusCode).toBe(400)

    const report = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'duplicate' },
    })
    expect(report.statusCode).toBe(201)

    const firstResolve = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${report.json().report.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'dismiss' },
    })
    expect(firstResolve.statusCode).toBe(200)

    const secondResolve = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${report.json().report.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'dismiss' },
    })
    expect(secondResolve.statusCode).toBe(409)
    expect(secondResolve.json().error.code).toBe('REPORT_ALREADY_REVIEWED')

    const unknownReport = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${crypto.randomUUID()}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'dismiss' },
    })
    expect(unknownReport.statusCode).toBe(404)
    expect(unknownReport.json().error.code).toBe('REPORT_NOT_FOUND')
  })
})
