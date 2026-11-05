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
  const email = `listing-appeal-${Date.now()}-${token}@example.com`
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
  const brandKey = `appeal-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`

  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Appeal Test', active: true })
    .returning('id')
    .executeTakeFirstOrThrow()
  brandIds.push(brand.id)

  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Appeal Test', active: true })
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
    provider: { code, sourceName: 'Listing appeal fixture', version: '1' },
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
  const imported = await importLocationSnapshot(db, locationSnapshot(`appeal-${crypto.randomUUID()}`))
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
  status: 'published' | 'rejected',
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
      title: '2024 Renault Clio itiraz testi ilanı',
      description: 'İtiraz ve moderasyon testi için hazırlanmış bireysel otomobil ilanı.',
      price_amount: '1250000',
      currency: 'TRY',
      province_id: location.province_id,
      district_id: location.district_id,
      neighborhood_id: location.neighborhood_id,
      contact_phone_e164: '+905551234567',
      show_phone: true,
      published_at: new Date(),
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

  return listing.id
}

async function createApartmentListing(
  ownerUserId: string,
  location: { province_id: string; district_id: string; neighborhood_id: string },
) {
  const apartmentSale = await db
    .selectFrom('listing_types')
    .select('id')
    .where('code', '=', 'apartment_sale')
    .executeTakeFirstOrThrow()

  const listing = await db.insertInto('listings')
    .values({
      owner_user_id: ownerUserId,
      listing_type_id: apartmentSale.id,
      status: 'rejected',
      title: '2024 daire itiraz testi ilanı',
      description: 'Daire itirazı testi için hazırlanmış bireysel konut ilanı.',
      price_amount: '3900000',
      currency: 'TRY',
      province_id: location.province_id,
      district_id: location.district_id,
      neighborhood_id: location.neighborhood_id,
      contact_phone_e164: '+905551234567',
      show_phone: true,
      published_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  listingIds.push(listing.id)

  await db.insertInto('apartment_details').values({
    listing_id: listing.id,
    transaction_type: 'sale',
    room_count: '2+1',
    gross_m2: 100,
    net_m2: 90,
    building_age: 5,
    floor: 3,
    total_floors: 8,
    heating: 'combi',
    bathroom_count: 1,
    kitchen: 'closed',
    balcony: true,
    elevator: true,
    parking: 'closed',
    furnished: false,
    occupancy: 'empty',
    in_site: true,
    deed_status: 'condominium',
    credit_eligible: true,
    swap_available: false,
  }).execute()

  return listing.id
}

function appealPayload(note = 'İlanımın reddedilmesi haksız; yeniden incelenmesini istiyorum.') {
  return { note }
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
    await db.deleteFrom('apartment_details').where('listing_id', 'in', listingIds).execute()
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

describe('listing appeals and moderation', () => {
  it('accepts one owner appeal and restores the listing when approved', async () => {
    const owner = await createSignedInUser('Appeal Owner')
    const other = await createSignedInUser('Other User')
    const moderator = await createSignedInUser('Appeal Moderator')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location, 'rejected')

    const guest = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { host: 'localhost:3000' },
      payload: appealPayload(),
    })
    expect(guest.statusCode).toBe(401)

    const foreign = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: other.cookie, host: 'localhost:3000' },
      payload: appealPayload(),
    })
    expect(foreign.statusCode).toBe(404)

    const short = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: { note: 'kısa' },
    })
    expect(short.statusCode).toBe(400)

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: appealPayload(),
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().appeal).toMatchObject({ status: 'pending' })

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: appealPayload(),
    })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('APPEAL_ALREADY_EXISTS')

    const ownListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(ownListings.statusCode).toBe(200)
    expect(ownListings.json().items[0].appealStatus).toBe('pending')

    const guestQueue = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/appeals',
      headers: { host: 'localhost:3000' },
    })
    expect(guestQueue.statusCode).toBe(401)

    const memberQueue = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/appeals',
      headers: { cookie: other.cookie, host: 'localhost:3000' },
    })
    expect(memberQueue.statusCode).toBe(403)

    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/appeals',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(queue.statusCode).toBe(200)
    expect(queue.json().items).toHaveLength(1)
    expect(queue.json().items[0]).toMatchObject({
      listingId,
      status: 'pending',
      listing: { type: 'car_sale', status: 'rejected' },
    })

    const approved = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/appeals/${created.json().appeal.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'approve', note: 'İtiraz haklı bulundu.' },
    })
    expect(approved.statusCode).toBe(200)
    expect(approved.json().appeal.status).toBe('approved')

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(200)

    const restored = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(restored.json().items[0]).toMatchObject({
      status: 'published',
      appealStatus: 'approved',
    })

    const secondReview = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/appeals/${created.json().appeal.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'reject' },
    })
    expect(secondReview.statusCode).toBe(409)
    expect(secondReview.json().error.code).toBe('APPEAL_ALREADY_REVIEWED')

    const stored = await sql<{ status: string; resolution_note: string | null }>`
      select status, resolution_note from listing_appeals where listing_id = ${listingId}::uuid
    `.execute(db)
    expect(stored.rows[0]).toMatchObject({
      status: 'approved',
      resolution_note: 'İtiraz haklı bulundu.',
    })
  })

  it('rejects an appeal and prevents appeals for non-rejected listings', async () => {
    const owner = await createSignedInUser('Rejected Appeal Owner')
    const moderator = await createSignedInUser('Rejecting Moderator')
    await makeModerator(moderator.cookie, moderator.userId)
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location, 'rejected')

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: appealPayload('Red kararının yeniden değerlendirilmesini talep ediyorum.'),
    })
    expect(created.statusCode).toBe(201)

    const rejected = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/appeals/${created.json().appeal.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'reject', note: 'Red kararı yerinde.' },
    })
    expect(rejected.statusCode).toBe(200)
    expect(rejected.json().appeal.status).toBe('rejected')

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(404)

    const ownListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(ownListings.json().items[0]).toMatchObject({
      status: 'rejected',
      appealStatus: 'rejected',
    })

    const publishedId = await createListing(owner.userId, modelId, location, 'published')
    const notAllowed = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${publishedId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: appealPayload(),
    })
    expect(notAllowed.statusCode).toBe(409)
    expect(notAllowed.json().error.code).toBe('APPEAL_NOT_ALLOWED')
  })

  it('restores an apartment listing after an approved appeal', async () => {
    const owner = await createSignedInUser('Apartment Appeal Owner')
    const moderator = await createSignedInUser('Apartment Appeal Moderator')
    await makeModerator(moderator.cookie, moderator.userId)
    const location = await createLocations()
    const listingId = await createApartmentListing(owner.userId, location)

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/appeal`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
      payload: appealPayload('Daire ilanımın red kararının yeniden incelenmesini istiyorum.'),
    })
    expect(created.statusCode).toBe(201)

    const approved = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/appeals/${created.json().appeal.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'approve' },
    })
    expect(approved.statusCode).toBe(200)

    const ownListings = await app.inject({
      method: 'GET',
      url: '/api/v1/me/apartment-listings',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(ownListings.statusCode).toBe(200)
    expect(ownListings.json().items[0]).toMatchObject({
      status: 'published',
      appealStatus: 'approved',
    })

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(200)
  })
})
