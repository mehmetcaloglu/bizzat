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
  const email = `staff-enforcement-${Date.now()}-${token}@example.com`
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
  return { userId, email, cookie: cookieHeader(signIn.headers['set-cookie']) }
}

async function ensureMe(cookie: string) {
  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { cookie, host: 'localhost:3000' },
  })
  expect(me.statusCode).toBe(200)
}

async function setRole(cookie: string, userId: string, role: 'moderator' | 'admin') {
  await ensureMe(cookie)
  await db.updateTable('profiles').set({ role }).where('user_id', '=', userId).execute()
}

async function createCanonicalModel() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const brandKey = `staff-brand:${suffix}`
  const seriesKey = `${brandKey}:series`
  const modelKey = `${seriesKey}:1-0-tce-evolution`
  const brand = await db.insertInto('vehicle_brands')
    .values({ catalog_key: brandKey, name: 'Renault Staff Test', active: true })
    .returning('id').executeTakeFirstOrThrow()
  brandIds.push(brand.id)
  const series = await db.insertInto('vehicle_series')
    .values({ brand_id: brand.id, catalog_key: seriesKey, name: 'Clio Staff Test', active: true })
    .returning('id').executeTakeFirstOrThrow()
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
    .returning('id').executeTakeFirstOrThrow()
  modelIds.push(model.id)
  return model.id
}

function locationSnapshot(code: string): NormalizedLocationSnapshot {
  return {
    provider: { code, sourceName: 'Staff enforcement fixture', version: '1' },
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
  const imported = await importLocationSnapshot(db, locationSnapshot(`staff-${crypto.randomUUID()}`))
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
) {
  const carSale = await db.selectFrom('listing_types').select('id')
    .where('code', '=', 'car_sale').executeTakeFirstOrThrow()
  const listing = await db.insertInto('listings').values({
    owner_user_id: ownerUserId,
    listing_type_id: carSale.id,
    status: 'published',
    title: '2024 Renault Clio staff testi ilanı',
    description: 'Customer service enforcement testi için hazırlanmış ilan.',
    price_amount: '1250000',
    currency: 'TRY',
    province_id: location.province_id,
    district_id: location.district_id,
    neighborhood_id: location.neighborhood_id,
    contact_phone_e164: '+905551234567',
    show_phone: true,
    published_at: new Date(),
  }).returning('id').executeTakeFirstOrThrow()
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

describe('staff account enforcement', () => {
  it('warns, suspends, blocks protected access, and reactivates a user', async () => {
    const moderator = await createSignedInUser('Staff Moderator')
    const user = await createSignedInUser('Warned User')
    await setRole(moderator.cookie, moderator.userId, 'moderator')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(user.userId, modelId, location)

    const guestSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/users',
      headers: { host: 'localhost:3000' },
    })
    expect(guestSearch.statusCode).toBe(401)

    const search = await app.inject({
      method: 'GET',
      url: `/api/v1/staff/users?q=${encodeURIComponent(user.email)}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(search.statusCode).toBe(200)
    expect(search.json().items[0]).toMatchObject({
      id: user.userId,
      accountStatus: 'active',
    })

    const warning = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${user.userId}/warnings`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'İlan açıklaması kurallara uygun değil.' },
    })
    expect(warning.statusCode).toBe(200)
    expect(warning.json().enforcement.action).toBe('warning')

    const meAfterWarning = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(meAfterWarning.statusCode).toBe(200)
    expect(meAfterWarning.json().profile.accountStatus).toBe('active')
    expect(meAfterWarning.json().enforcements[0]).toMatchObject({
      action: 'warning',
      reason: 'İlan açıklaması kurallara uygun değil.',
    })

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/staff/users/${user.userId}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().user.warningCount).toBe(1)
    expect(detail.json().listings[0].id).toBe(listingId)

    const suspended = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${user.userId}/suspend`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'Tekrarlanan kural ihlali.', days: 7 },
    })
    expect(suspended.statusCode).toBe(200)
    expect(suspended.json().user.accountStatus).toBe('suspended')
    expect(suspended.json().enforcement.endsAt).not.toBeNull()

    const listingAfterSuspend = await db.selectFrom('listings').select('status')
      .where('id', '=', listingId).executeTakeFirstOrThrow()
    expect(listingAfterSuspend.status).toBe('inactive')

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().error.code).toBe('ACCOUNT_SUSPENDED')

    const meSuspended = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(meSuspended.statusCode).toBe(200)
    expect(meSuspended.json().profile.accountStatus).toBe('suspended')
    expect(meSuspended.json().profile.suspendedUntil).not.toBeNull()

    const reactivated = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${user.userId}/reactivate`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'Askı süresi yönetici kararıyla kaldırıldı.' },
    })
    expect(reactivated.statusCode).toBe(200)
    expect(reactivated.json().user.accountStatus).toBe('active')

    const allowedAgain = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(allowedAgain.statusCode).toBe(200)
  })

  it('enforces hierarchy and allows admins to act on moderators', async () => {
    const admin = await createSignedInUser('Super Admin')
    const moderator = await createSignedInUser('Peer Moderator')
    const peerModerator = await createSignedInUser('Peer Target Moderator')
    const user = await createSignedInUser('Target User')
    await setRole(admin.cookie, admin.userId, 'admin')
    await setRole(moderator.cookie, moderator.userId, 'moderator')
    await setRole(peerModerator.cookie, peerModerator.userId, 'moderator')

    const peerAction = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${peerModerator.userId}/warnings`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'Bu işlem yetki sınırını aşıyor.' },
    })
    expect(peerAction.statusCode).toBe(403)

    const adminAction = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${peerModerator.userId}/warnings`,
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
      payload: { reason: 'Moderatör işlemleri denetlendi.' },
    })
    expect(adminAction.statusCode).toBe(200)

    const adminTarget = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${admin.userId}/warnings`,
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
      payload: { reason: 'Kendi hesabına işlem uygulanamaz.' },
    })
    expect(adminTarget.statusCode).toBe(400)

    const ban = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/users/${user.userId}/ban`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'Kalıcı kural ihlali.' },
    })
    expect(ban.statusCode).toBe(200)
    expect(ban.json().user.accountStatus).toBe('banned')

    const bannedMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(bannedMe.json().profile.accountStatus).toBe('banned')

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().error.code).toBe('ACCOUNT_BANNED')
  })

  it('gives super admins system summary and role management', async () => {
    const admin = await createSignedInUser('Summary Admin')
    const user = await createSignedInUser('Role Target')
    const moderator = await createSignedInUser('Summary Moderator')
    await setRole(admin.cookie, admin.userId, 'admin')
    await setRole(moderator.cookie, moderator.userId, 'moderator')

    const userSummary = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(userSummary.statusCode).toBe(403)

    const moderatorSummary = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(moderatorSummary.statusCode).toBe(403)

    const summary = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
    })
    expect(summary.statusCode).toBe(200)
    expect(summary.json().users.admins).toBeGreaterThanOrEqual(1)
    expect(summary.json().users.moderators).toBeGreaterThanOrEqual(1)

    const roleChange = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${user.userId}/role`,
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
      payload: { role: 'moderator' },
    })
    expect(roleChange.statusCode).toBe(200)
    expect(roleChange.json().user.role).toBe('moderator')
    expect(roleChange.json().enforcement.action).toBe('role_change')

    const newModeratorStaffAccess = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/users',
      headers: { cookie: user.cookie, host: 'localhost:3000' },
    })
    expect(newModeratorStaffAccess.statusCode).toBe(200)

    const selfRoleChange = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${admin.userId}/role`,
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
      payload: { role: 'moderator' },
    })
    expect(selfRoleChange.statusCode).toBe(400)

    const enforcements = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/enforcements',
      headers: { cookie: admin.cookie, host: 'localhost:3000' },
    })
    expect(enforcements.statusCode).toBe(200)
    expect(enforcements.json().items[0]).toMatchObject({
      action: 'role_change',
      targetUserId: user.userId,
    })
  })

  it('takes down a listing from the customer service panel', async () => {
    const moderator = await createSignedInUser('Listing Moderator')
    const owner = await createSignedInUser('Takedown Owner')
    await setRole(moderator.cookie, moderator.userId, 'moderator')
    const modelId = await createCanonicalModel()
    const location = await createLocations()
    const listingId = await createListing(owner.userId, modelId, location)

    const takedown = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/listings/${listingId}/takedown`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { reason: 'İlan kurallara aykırı içerik barındırıyor.' },
    })
    expect(takedown.statusCode).toBe(200)
    expect(takedown.json().listing).toMatchObject({ id: listingId, status: 'rejected' })
    expect(takedown.json().enforcement.action).toBe('listing_takedown')

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/car-sale/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(404)
  })
})
