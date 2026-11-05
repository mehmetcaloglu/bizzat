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
const mediaRoot = `/tmp/bizzat-apartment-media-${process.pid}`
process.env.BIZZAT_MEDIA_ROOT = mediaRoot
process.env.EIDS_PROVIDER = 'mock'

let db: Kysely<Database>
let app: FastifyInstance
const authPool = createAuthPool(databaseUrl)
const auth = createAuth({ databaseUrl, baseUrl, secret }, authPool)
const userIds: string[] = []
const listingIds: string[] = []

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
}

async function createSignedInUser(label: string) {
  const token = crypto.randomUUID().slice(0, 8)
  const email = `apartment-${Date.now()}-${token}@example.com`
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

function locationSnapshot(): NormalizedLocationSnapshot {
  return {
    provider: { code: `apartment-${crypto.randomUUID()}`, sourceName: 'Apartment fixture', version: '1' },
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

async function createLocation() {
  const imported = await importLocationSnapshot(db, locationSnapshot())
  const result = await sql<{
    province_id: string
    district_id: string
    neighborhood_id: string
  }>`
    select p.id::text as province_id, d.id::text as district_id, n.id::text as neighborhood_id
    from provinces p
    join districts d on d.province_id = p.id
    join neighborhoods n on n.district_id = d.id
    where p.provider_id = ${imported.providerId}::uuid
  `.execute(db)
  const row = result.rows[0]
  if (!row) throw new Error('apartment location fixture missing')
  return row
}

async function createApartmentDraft(cookie: string, transactionType: 'sale' | 'rent') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/listings/apartment/drafts',
    headers: { cookie, host: 'localhost:3000' },
    payload: { transactionType },
  })
  expect(response.statusCode).toBe(201)
  const listingId = response.json().listing.id as string
  listingIds.push(listingId)
  return listingId
}

function detailsPayload(
  location: Awaited<ReturnType<typeof createLocation>>,
  transactionType: 'sale' | 'rent',
  overrides: {
    priceAmount: number
    roomCount: string
    grossM2: number
    furnished?: boolean
    floor?: number | null
    floorLabel?: string | null
  },
) {
  return {
    priceAmount: overrides.priceAmount,
    provinceId: location.province_id,
    districtId: location.district_id,
    neighborhoodId: location.neighborhood_id,
    description: 'Daire dikey dilimi için hazırlanmış açıklama metni.',
    title: `${overrides.roomCount} daire test ilanı`,
    contactPhoneE164: '+905551234567',
    showPhone: true,
    roomCount: overrides.roomCount,
    grossM2: overrides.grossM2,
    netM2: overrides.grossM2 - 10,
    buildingAge: 5,
    floor: overrides.floor === undefined ? 3 : overrides.floor,
    floorLabel: overrides.floorLabel ?? null,
    totalFloors: 8,
    heating: 'combi',
    bathroomCount: 1,
    kitchen: 'closed',
    balcony: true,
    elevator: true,
    parking: 'closed',
    furnished: overrides.furnished ?? false,
    occupancy: 'empty',
    inSite: true,
    deedStatus: 'condominium',
    creditEligible: transactionType === 'sale' ? true : null,
    swapAvailable: transactionType === 'sale' ? false : null,
    depositAmount: transactionType === 'rent' ? 64000 : null,
  }
}

async function updateDetails(
  cookie: string,
  listingId: string,
  payload: ReturnType<typeof detailsPayload>,
) {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/v1/listings/${listingId}/apartment-details`,
    headers: { cookie, host: 'localhost:3000' },
    payload,
  })
  expect(response.statusCode).toBe(200)
  return response
}

async function uploadImage(cookie: string, listingId: string) {
  const bytes = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: { r: 46, g: 110, b: 160 },
    },
  }).jpeg().toBuffer()
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/apartment/images`,
    headers: { cookie, host: 'localhost:3000', 'content-type': 'image/jpeg' },
    payload: bytes,
  })
  expect(response.statusCode).toBe(201)
  return response
}

async function publish(cookie: string, listingId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/apartment/publish`,
    headers: { cookie, host: 'localhost:3000' },
  })
  expect(response.statusCode).toBe(200)
  return response
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
    await db.deleteFrom('listings').where('id', 'in', listingIds.splice(0)).execute()
  }
  for (const userId of userIds.splice(0)) {
    await sql`delete from auth."user" where id = ${userId}::uuid`.execute(db)
  }
})

afterAll(async () => {
  await app.close()
  await db.destroy()
  await authPool.end()
  await rm(mediaRoot, { recursive: true, force: true })
})

describe('apartment vertical', () => {
  it('rejects publishing an apartment without a photo', async () => {
    const owner = await createSignedInUser('Fotoğrafsız Daire Sahibi')
    const location = await createLocation()
    const listingId = await createApartmentDraft(owner.cookie, 'sale')
    await updateDetails(owner.cookie, listingId, detailsPayload(location, 'sale', {
      priceAmount: 2_500_000,
      roomCount: '2+1',
      grossM2: 100,
    }))

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/apartment/publish`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('LISTING_INCOMPLETE')

    const persisted = await db.selectFrom('listings')
      .select('status')
      .where('id', '=', listingId)
      .executeTakeFirstOrThrow()
    expect(persisted.status).toBe('draft')
  })

  it('respects the apartment phone visibility preference', async () => {
    const owner = await createSignedInUser('Gizli Telefonlu Daire Sahibi')
    const location = await createLocation()
    const listingId = await createApartmentDraft(owner.cookie, 'sale')
    const payload = detailsPayload(location, 'sale', {
      priceAmount: 3_500_000,
      roomCount: '2+1',
      grossM2: 110,
    })
    payload.showPhone = false
    await updateDetails(owner.cookie, listingId, payload)
    await uploadImage(owner.cookie, listingId)
    await publish(owner.cookie, listingId)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().listing.contact.showPhone).toBe(false)
    expect(JSON.stringify(detail.json())).not.toContain('+905551234567')

    const contact = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${listingId}/contact`,
      headers: { host: 'localhost:3000' },
    })
    expect(contact.statusCode).toBe(404)
    expect(contact.json().error.code).toBe('LISTING_CONTACT_NOT_AVAILABLE')
  })

  it('edits published and inactive apartment listings while protecting the last published photo', async () => {
    const owner = await createSignedInUser('Daire Düzenleme Sahibi')
    const location = await createLocation()
    const listingId = await createApartmentDraft(owner.cookie, 'sale')
    await updateDetails(owner.cookie, listingId, detailsPayload(location, 'sale', {
      priceAmount: 4_250_000,
      roomCount: '2+1',
      grossM2: 105,
    }))
    const firstUpload = await uploadImage(owner.cookie, listingId)
    const firstImageId = firstUpload.json().listing.images[0].id as string
    await publish(owner.cookie, listingId)

    const ownedPublished = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}/apartment`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(ownedPublished.statusCode).toBe(200)
    expect(ownedPublished.json().listing.status).toBe('published')

    const editPublished = await updateDetails(owner.cookie, listingId, detailsPayload(location, 'sale', {
      priceAmount: 4_400_000,
      roomCount: '2+1',
      grossM2: 105,
    }))
    expect(editPublished.json().listing.status).toBe('published')
    expect(editPublished.json().listing.details.priceAmount).toBe(4_400_000)

    const publicDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(publicDetail.statusCode).toBe(200)
    expect(publicDetail.json().listing.priceAmount).toBe(4_400_000)

    const removeOnlyPhoto = await app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/apartment/images/${firstImageId}`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(removeOnlyPhoto.statusCode).toBe(409)
    expect(removeOnlyPhoto.json().error.code).toBe('LISTING_NOT_EDITABLE')

    await uploadImage(owner.cookie, listingId)
    const removeFirstPhoto = await app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listingId}/apartment/images/${firstImageId}`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(removeFirstPhoto.statusCode).toBe(200)
    expect(removeFirstPhoto.json().listing.images).toHaveLength(1)

    const unpublish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listingId}/apartment/unpublish`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(unpublish.statusCode).toBe(200)

    const editInactive = await updateDetails(owner.cookie, listingId, detailsPayload(location, 'sale', {
      priceAmount: 4_500_000,
      roomCount: '2+1',
      grossM2: 105,
    }))
    expect(editInactive.json().listing.status).toBe('inactive')
    expect(editInactive.json().listing.details.priceAmount).toBe(4_500_000)

    const ownedInactive = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listingId}/apartment`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(ownedInactive.statusCode).toBe(200)
    expect(ownedInactive.json().listing.status).toBe('inactive')

    await publish(owner.cookie, listingId)
  })

  it('supports special floor labels in detail and feed filters', async () => {
    const owner = await createSignedInUser('Bahçe Katı Sahibi')
    const location = await createLocation()
    const listingId = await createApartmentDraft(owner.cookie, 'sale')
    await updateDetails(owner.cookie, listingId, detailsPayload(location, 'sale', {
      priceAmount: 3_900_000,
      roomCount: '2+1',
      grossM2: 100,
      floor: null,
      floorLabel: 'garden',
    }))
    await uploadImage(owner.cookie, listingId)
    await publish(owner.cookie, listingId)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${listingId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().listing.floor).toBeNull()
    expect(detail.json().listing.attributes.floorLabel).toBe('garden')

    const gardenFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&floorLabel=garden',
      headers: { host: 'localhost:3000' },
    })
    expect(gardenFeed.statusCode).toBe(200)
    expect((gardenFeed.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([listingId])

    const atticFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&floorLabel=attic',
      headers: { host: 'localhost:3000' },
    })
    expect(atticFeed.statusCode).toBe(200)
    expect(atticFeed.json().items).toHaveLength(0)
  })

  it('creates, publishes, filters, reads, contacts, lists, and unpublishes sale/rent apartments', async () => {
    const owner = await createSignedInUser('Daire Sahibi')
    const location = await createLocation()

    const saleOneId = await createApartmentDraft(owner.cookie, 'sale')
    const saleOne = await updateDetails(owner.cookie, saleOneId, detailsPayload(location, 'sale', {
      priceAmount: 4_250_000,
      roomCount: '2+1',
      grossM2: 105,
      furnished: false,
    }))
    expect(saleOne.json().listing).toMatchObject({
      id: saleOneId,
      type: 'apartment_sale',
      transactionType: 'sale',
      title: '2+1 daire test ilanı',
    })
    expect(saleOne.json().listing.details.location).toMatchObject({
      province: { name: 'İstanbul' },
      district: { name: 'Güngören' },
      neighborhood: { name: 'Haznedar' },
    })
    await uploadImage(owner.cookie, saleOneId)
    await publish(owner.cookie, saleOneId)
    const checks = await sql<{ type: string; status: string }>`
      select type, status from verification_checks where listing_id = ${saleOneId}::uuid
    `.execute(db)
    expect(checks.rows[0]).toMatchObject({ type: 'property_authority', status: 'verified' })

    const saleTwoId = await createApartmentDraft(owner.cookie, 'sale')
    await updateDetails(owner.cookie, saleTwoId, detailsPayload(location, 'sale', {
      priceAmount: 3_100_000,
      roomCount: '3+1',
      grossM2: 140,
      furnished: true,
    }))
    await uploadImage(owner.cookie, saleTwoId)
    await publish(owner.cookie, saleTwoId)

    const rentId = await createApartmentDraft(owner.cookie, 'rent')
    const rent = await updateDetails(owner.cookie, rentId, detailsPayload(location, 'rent', {
      priceAmount: 32_000,
      roomCount: '1+1',
      grossM2: 65,
      furnished: true,
    }))
    expect(rent.json().listing).toMatchObject({
      type: 'apartment_rent',
      transactionType: 'rent',
      details: { depositAmount: 64000 },
    })
    await uploadImage(owner.cookie, rentId)
    await publish(owner.cookie, rentId)

    const saleFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&sort=price_asc',
      headers: { host: 'localhost:3000' },
    })
    expect(saleFeed.statusCode).toBe(200)
    expect((saleFeed.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([
      saleTwoId,
      saleOneId,
    ])

    const grossSortFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&sort=gross_m2_desc',
      headers: { host: 'localhost:3000' },
    })
    expect(grossSortFeed.statusCode).toBe(200)
    expect((grossSortFeed.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([
      saleTwoId,
      saleOneId,
    ])

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&sort=price_asc&limit=1',
      headers: { host: 'localhost:3000' },
    })
    expect(firstPage.statusCode).toBe(200)
    expect((firstPage.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([saleTwoId])
    expect(typeof firstPage.json().nextCursor).toBe('string')

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment?transactionType=sale&sort=price_asc&limit=1&cursor=${encodeURIComponent(firstPage.json().nextCursor as string)}`,
      headers: { host: 'localhost:3000' },
    })
    expect(secondPage.statusCode).toBe(200)
    expect((secondPage.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([saleOneId])
    expect(secondPage.json().nextCursor).toBeNull()

    const filteredFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=sale&roomCount=2%2B1&minGrossM2=100&heating=combi&inSite=true&furnished=false',
      headers: { host: 'localhost:3000' },
    })
    expect(filteredFeed.statusCode).toBe(200)
    expect((filteredFeed.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([saleOneId])

    const rentFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/listings/public/apartment?transactionType=rent',
      headers: { host: 'localhost:3000' },
    })
    expect(rentFeed.statusCode).toBe(200)
    expect((rentFeed.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual([rentId])

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${saleOneId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().listing).toMatchObject({
      id: saleOneId,
      priceAmount: 4_250_000,
      roomCount: '2+1',
      grossM2: 105,
      location: {
        provinceName: 'İstanbul',
        districtName: 'Güngören',
        neighborhoodName: 'Haznedar',
      },
      attributes: {
        heating: 'combi',
        elevator: true,
        parking: 'closed',
        deedStatus: 'condominium',
        creditEligible: true,
      },
      contact: { showPhone: true },
    })
    expect(detail.json().listing.description).toContain('Daire dikey dilimi')
    expect(detail.json().listing.images).toHaveLength(1)
    expect(JSON.stringify(detail.json())).not.toContain('+905551234567')

    const contact = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${saleOneId}/contact`,
      headers: { host: 'localhost:3000' },
    })
    expect(contact.statusCode).toBe(200)
    expect(contact.json().phoneE164).toBe('+905551234567')

    const own = await app.inject({
      method: 'GET',
      url: '/api/v1/me/apartment-listings',
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(own.statusCode).toBe(200)
    expect(own.json().items).toHaveLength(3)
    expect(own.json().items).toContainEqual(expect.objectContaining({
      id: saleOneId,
      type: 'apartment_sale',
      status: 'published',
      roomCount: '2+1',
    }))

    const moderator = await createSignedInUser('Daire Moderatörü')
    const moderatorMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(moderatorMe.statusCode).toBe(200)
    await db.updateTable('profiles').set({ role: 'moderator' })
      .where('user_id', '=', moderator.userId).execute()
    const report = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${saleTwoId}/reports`,
      headers: { host: 'localhost:3000' },
      payload: { reason: 'fraud', note: 'Daire ilanı moderasyon testi.' },
    })
    expect(report.statusCode).toBe(201)

    const moderationQueue = await app.inject({
      method: 'GET',
      url: '/api/v1/moderation/reports',
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
    })
    expect(moderationQueue.statusCode).toBe(200)
    expect(moderationQueue.json().items).toContainEqual(expect.objectContaining({
      listingId: saleTwoId,
      reason: 'fraud',
      status: 'open',
    }))
    expect(moderationQueue.json().items[0].listing.title).toBe('3+1 daire test ilanı')

    const reject = await app.inject({
      method: 'PATCH',
      url: `/api/v1/moderation/reports/${report.json().report.id}`,
      headers: { cookie: moderator.cookie, host: 'localhost:3000' },
      payload: { action: 'reject', note: 'Daire ilanı incelendi ve yayından kaldırıldı.' },
    })
    expect(reject.statusCode).toBe(200)
    expect(reject.json().report.status).toBe('resolved')

    const rejectedDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${saleTwoId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(rejectedDetail.statusCode).toBe(404)

    const republishRejected = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${saleTwoId}/apartment/publish`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(republishRejected.statusCode).toBe(409)
    expect(republishRejected.json().error.code).toBe('LISTING_NOT_EDITABLE')

    const unpublish = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${saleOneId}/apartment/unpublish`,
      headers: { cookie: owner.cookie, host: 'localhost:3000' },
    })
    expect(unpublish.statusCode).toBe(200)
    expect(unpublish.json().listing.status).toBe('inactive')

    const unpublishedDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/public/apartment/${saleOneId}`,
      headers: { host: 'localhost:3000' },
    })
    expect(unpublishedDetail.statusCode).toBe(404)
  })
})
