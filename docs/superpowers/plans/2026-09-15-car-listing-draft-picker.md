# Car Listing Draft Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real Bizzat product vertical slice: an authenticated `car_sale` draft whose canonical vehicle identity is a terminal `vehicle_models.id`, selected through the existing variable-depth vehicle picker.

**Architecture:** Keep the existing TypeScript modular monolith. Add minimum relational `listing_types`, `listings`, and `car_details` tables, a focused listings module, shared TypeBox contracts, and a responsive Next.js picker page. Do not add a generic EAV/form engine, EİDS, publish transitions, price/year/km/media, or duplicate brand/series IDs in `car_details`.

**Tech Stack:** Node 24 LTS, pnpm 10.34.5, PostgreSQL 18, Kysely + `pg`, Fastify + TypeBox, Better Auth, Next.js 16, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-car-listing-draft-picker-design.md`

## Global Constraints

- Work only on `feat/car-listing-draft-picker`; never implement directly on `main`.
- Canonical listing vehicle identity is only terminal `vehicle_models.id`.
- Runtime vehicle data comes only from canonical PostgreSQL tables; never join TSB/source tables into the listing flow.
- `model_year`, mileage, price, location, EİDS, media, description, contact preferences, publish, and moderation are out of this slice.
- `owner_user_id` always comes from the Better Auth session; clients cannot set owner or status.
- Only active canonical vehicle models can create a draft.
- Draft create writes `listings` + `car_details` atomically.
- Another user's draft is exposed as `404 LISTING_NOT_FOUND`, not `403`.
- Do not add Redis, queues, microservices, a generic DI framework, a generic listing-schema package, or new frontend test libraries.
- User-facing copy is Turkish and uses `sen`.
- Existing vehicle reference HTTP contracts remain backwards compatible.
- TDD is mandatory: add failing behavior tests before production implementation.

---

### Task 1: Minimum listing persistence

**Files:**
- Create: `apps/api/src/db/domain-migrations/0007_create_listing_draft_tables.ts`
- Modify: `apps/api/src/db/client.ts`
- Create: `apps/api/test/listing-draft-migration.integration.test.ts`

**Interfaces:**
- Produces DB tables `listing_types`, `listings`, and `car_details`.
- Produces Kysely interfaces `ListingTypesTable`, `ListingsTable`, and `CarDetailsTable` in `Database`.
- Later tasks depend on `listing_types.code = 'car_sale'`, `listings.status = 'draft'`, and `car_details.vehicle_model_id`.

- [ ] **Step 1: Write the failing migration integration test**

Create a PostgreSQL integration test that runs bootstrap → auth → domain migrations and asserts:

```ts
const carSale = await db
  .selectFrom('listing_types')
  .select(['id', 'code'])
  .where('code', '=', 'car_sale')
  .executeTakeFirstOrThrow()
expect(carSale.code).toBe('car_sale')
```

Then create a real auth user and assert the DB accepts a `draft` listing plus matching `car_details`, while invalid status and nonexistent model FK inserts reject.

- [ ] **Step 2: Run CI with test-only change and verify RED**

Expected failure: missing `listing_types` / `listings` / `car_details` table or missing Kysely table typings. The failure must be caused by the unimplemented feature, not test setup.

- [ ] **Step 3: Add migration and Kysely typings**

Migration shape:

```sql
create table listing_types (
  id uuid primary key default uuidv7(),
  code text not null unique,
  created_at timestamptz not null default now()
);

insert into listing_types (code) values ('car_sale')
on conflict (code) do nothing;

create table listings (
  id uuid primary key default uuidv7(),
  owner_user_id uuid not null references auth."user"(id) on delete cascade,
  listing_type_id uuid not null references listing_types(id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_status_check check (
    status in ('draft','pending_verification','pending_review','published','rejected','inactive')
  )
);

create table car_details (
  listing_id uuid primary key references listings(id) on delete cascade,
  vehicle_model_id uuid not null references vehicle_models(id)
);
```

Down migration drops `car_details`, `listings`, then `listing_types`.

Kysely types use `Generated<string>` / `Generated<Date>` consistently with existing DB interfaces.

- [ ] **Step 4: Run full CI and verify GREEN**

Expected: migrations, existing vehicle imports/tests, all previous tests, typecheck and build remain green.

- [ ] **Step 5: Commit**

Commit message: `feat: add minimum car listing draft tables`

---

### Task 2: Shared draft contract and canonical vehicle lookup

**Files:**
- Create: `packages/contracts/src/listing.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/reference/vehicle/vehicle-catalog.repository.ts`
- Modify: `apps/api/src/reference/vehicle/vehicle-catalog.service.ts`
- Create: `apps/api/test/vehicle-catalog-listing-lookup.integration.test.ts`

**Interfaces:**
- Produces `CreateCarSaleDraftRequestSchema` with exactly `{ vehicleModelId: uuid }`.
- Produces `CarSaleDraftResponseSchema` with listing id/status/type and canonical vehicle summary.
- Produces internal `VehicleCatalogService.findActiveModelSummary(modelId)` returning either canonical `{ modelId, brand, series, selectionPath }` or `null`.

- [ ] **Step 1: Write failing canonical lookup tests**

After importing the deterministic vehicle fixture, test that an active model returns its brand, series and effective selection path, while an unknown/inactive model returns `null`.

Expected shape:

```ts
expect(summary).toMatchObject({
  modelId,
  brand: { id: expect.any(String), name: expect.any(String) },
  series: { id: expect.any(String), name: expect.any(String) },
})
expect(summary?.selectionPath.at(-1)?.key).toBe(modelCatalogKey)
```

- [ ] **Step 2: Verify RED**

Expected failure: `findActiveModelSummary` does not exist.

- [ ] **Step 3: Implement contract schemas and lookup**

Repository adds one canonical join only:

```text
vehicle_models
  -> vehicle_series
  -> vehicle_brands
```

The query requires all three rows to be active and does not touch `vehicle_source_*`.

If legacy fixture `selection_path` is null, service returns one leaf node using `{ key: catalog_key, name }`, matching existing selection fallback behavior.

- [ ] **Step 4: Verify GREEN and contracts build**

Run normal CI. Expect contracts typecheck/build plus API lookup tests to pass.

- [ ] **Step 5: Commit**

Commit message: `feat: expose canonical vehicle lookup for listing drafts`

---

### Task 3: Authenticated car-sale draft API

**Files:**
- Create: `apps/api/src/modules/listings/listing.repository.ts`
- Create: `apps/api/src/modules/listings/listing.service.ts`
- Create: `apps/api/src/modules/listings/listing.routes.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/listing-draft.integration.test.ts`

**Interfaces:**
- `POST /api/v1/listings/car-sale/drafts` consumes `{ vehicleModelId }` and returns `201 CarSaleDraftResponse`.
- `GET /api/v1/listings/:listingId` returns the authenticated owner's draft summary.
- `ListingService.createCarSaleDraft(ownerUserId, vehicleModelId)` owns validation and transaction boundaries.
- `ListingService.getOwnedDraft(ownerUserId, listingId)` hides non-owned/missing records behind `LISTING_NOT_FOUND`.

- [ ] **Step 1: Write failing route integration tests**

Use the existing Better Auth integration setup to create two users and session cookies. Cover:

```text
anonymous POST -> 401 UNAUTHENTICATED
active model POST -> 201
unknown/inactive model POST -> 400/404 stable listing error
payload cannot set owner/status (schema rejects extra fields or ignores none)
created listings.owner_user_id == session user
created status == draft
listing + car_details both exist
owner GET -> 200
second user GET -> 404 LISTING_NOT_FOUND
response contains canonical brand/series/selectionPath
```

Use unique test emails and real PostgreSQL.

- [ ] **Step 2: Verify RED**

Expected failure: listing routes/module do not exist.

- [ ] **Step 3: Implement repository**

Repository methods:

```ts
findListingTypeByCode('car_sale')
insertDraft(trx, { ownerUserId, listingTypeId })
insertCarDetail(trx, { listingId, vehicleModelId })
findOwnedCarDraft(ownerUserId, listingId)
```

Read query joins listing type + `car_details`; canonical vehicle display data remains owned by `VehicleCatalogService`.

- [ ] **Step 4: Implement service transaction**

Pseudo-flow:

```ts
const vehicle = await vehicleCatalog.findActiveModelSummary(vehicleModelId)
if (!vehicle) throw new AppError(400, 'VEHICLE_MODEL_NOT_AVAILABLE', 'Seçtiğin araç modeli kullanılamıyor.')

const listingType = await repository.findListingTypeByCode('car_sale')
if (!listingType) throw new AppError(500, 'INTERNAL_ERROR', '...')

const listing = await db.transaction().execute(async (trx) => {
  const created = await repository.insertDraft(trx, ...)
  await repository.insertCarDetail(trx, ...)
  return created
})
```

`GET` verifies ownership before returning; no public published-listing semantics are added.

- [ ] **Step 5: Implement route composition**

Routes call `getAuthSession(options.auth, request.headers)` exactly like `/api/v1/me`. Register listings routes only when `auth + db + authBaseUrl` are available, under `/api/v1`.

- [ ] **Step 6: Verify GREEN**

Normal CI must pass integration tests, existing reference tests, lint, typecheck and build.

- [ ] **Step 7: Commit**

Commit message: `feat: add authenticated car listing draft API`

---

### Task 4: Responsive canonical vehicle picker page

**Files:**
- Create: `apps/web/app/ilan-ver/otomobil/page.tsx`
- Create: `apps/web/app/ilan-ver/otomobil/vehicle-picker.tsx`
- Create: `apps/web/app/ilan-ver/otomobil/vehicle-picker-state.ts`
- Create: `apps/web/lib/api-client.ts`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/test/car-listing-picker.test.tsx`
- Create: `apps/web/test/vehicle-picker-state.test.ts`

**Interfaces:**
- Page route: `/ilan-ver/otomobil`.
- `api-client.ts` exposes typed fetch helpers for `/me`, vehicle reference endpoints, and draft create.
- State helper owns reset semantics so changing an ancestor can never leave a stale terminal model id.

- [ ] **Step 1: Write RED state tests**

Pure reducer/helper tests cover:

```ts
selectBrand(...) // clears series, path, terminal model
selectSeries(...) // clears path, terminal model
selectGroup(...) // appends/replaces depth and clears descendants/model
selectModel(...) // sets terminal model
```

Assert explicitly that changing brand or series removes any previous `vehicleModelId`.

- [ ] **Step 2: Write RED page rendering test**

Using existing `react-dom/server` Vitest style, render the page shell and assert user-facing copy such as:

```text
Satılık otomobil ilanı
Marka
Seri
Araç detayını seç
İlan taslağını oluştur
```

No fake year/price/media fields should appear.

- [ ] **Step 3: Verify RED**

Expected failure: files/components do not exist.

- [ ] **Step 4: Implement typed API client**

Use same-origin `/api/...` fetch so existing Next rewrite continues to proxy to Fastify in local/prod configuration. Throw a small typed client error carrying API error code/status; do not add a data-fetching library.

- [ ] **Step 5: Implement picker state and client component**

Behavior:

```text
load /me
  -> unauthenticated: show “Giriş yap” CTA
  -> authenticated: load brands
brand -> load series
series -> load root selection
selection group -> load next level with parentKey
selection model -> store terminal UUID and stop traversal
CTA -> POST draft
success -> show listing id + selected breadcrumb
```

Disable CTA until a terminal model exists and while request is pending. Stale `404` selection responses clear the affected descendant state and ask the user to choose again.

- [ ] **Step 6: Apply Bizzat visual direction**

Use the existing light-blue/white/dark-gray palette already present in the project. Keep one focused selection surface, restrained borders, readable breadcrumb, mobile single-column flow, visible focus states, and no gradients/dashboard-card clutter.

- [ ] **Step 7: Verify GREEN**

Normal CI must pass web tests, lint, typecheck, build and Next standalone verification.

- [ ] **Step 8: Commit**

Commit message: `feat: add car listing canonical vehicle picker`

---

### Task 5: Final vertical-slice verification and PR hardening

**Files:**
- Modify only files required by verified failures; no scope expansion.
- Update: `docs/superpowers/specs/2026-09-15-car-listing-draft-picker-design.md` status to implemented only after final verification.
- Update: PR body with actual test/CI evidence.

**Interfaces:**
- End state is one draft PR from `feat/car-listing-draft-picker` to `feat/vehicle-curation-policy-batch-3`.
- No merge without explicit user instruction.

- [ ] **Step 1: Run final permanent CI on clean feature head**

Required green steps:

```text
pnpm install --frozen-lockfile
lint
typecheck
explicit migrations
location fixture import
vehicle curation fixture generation
real curated catalog import
deterministic TSB fixture/mapping/report
all API + integration + web tests
build
Next standalone verification
```

- [ ] **Step 2: Inspect final diff for scope leaks**

Reject/remove any accidental:

```text
TSB/source joins in runtime listing flow
duplicate brand_id/series_id in car_details
model_year/price/km/EİDS/media fields
generic EAV/form abstractions
new infrastructure/dependencies not needed by the slice
owner/status accepted from client
```

- [ ] **Step 3: Verify behavior evidence**

Confirm from tests/DB assertions that:

```text
terminal canonical UUID is persisted
inactive/unknown model fails closed
listing + car_details are atomic
session user owns the draft
cross-user draft read returns 404
variable-depth picker reset semantics prevent stale model ids
```

- [ ] **Step 4: Update documentation and PR body with real evidence**

Do not write estimated test counts or claim green before the final run actually completes.

- [ ] **Step 5: Keep PR draft/open**

Do not merge. Report final PR URL, head SHA, CI run id, and any intentionally deferred next slice (vehicle year/km/attributes or EİDS, whichever is chosen next).
