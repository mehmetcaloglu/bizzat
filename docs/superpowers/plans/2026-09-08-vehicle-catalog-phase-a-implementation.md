# Vehicle Catalog Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-hosted canonical automobile `Marka -> Seri -> Model` foundation with stable Bizzat IDs, explicit catalog import tooling, and public read-only hierarchy endpoints.

**Architecture:** Phase A adds only the Bizzat-owned canonical taxonomy. A repository-owned normalized JSON file is imported explicitly into PostgreSQL; runtime requests read PostgreSQL only. TSB/source-provider ingestion and mapping remain Phase B and must not appear in this implementation.

**Tech Stack:** Node.js 24 LTS, TypeScript 6, Fastify, TypeBox, Kysely, PostgreSQL 18, Vitest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-08-vehicle-catalog-design.md`

## Global Constraints

- Phase A covers MVP automobiles only and introduces no TSB/source-provider tables.
- Listings and public contracts use Bizzat UUID identities, never provider IDs.
- Canonical hierarchy is exactly `brand -> series -> model`; no generation/engine/trim/spec tables.
- `model_year` is not part of this catalog and no `vehicle_model_years` table is created.
- Canonical display names are mutable; `catalog_key` is the stable import identity.
- Missing canonical entries are marked inactive, never hard-deleted.
- Catalog imports are explicit maintenance commands; API startup never imports catalog data.
- Normal runtime performs zero external HTTP calls for vehicle reference data.
- Reuse the existing `REFERENCE_PARENT_NOT_FOUND` API error code for unknown/inactive hierarchy parents.
- Do not add Redis, search infrastructure, caches, queues, new services, or new runtime dependencies.
- All DB behavior must be covered against real PostgreSQL 18; repository mocks do not replace integration tests.

---

## File Map

**Database**
- `apps/api/src/db/domain-migrations/0004_create_vehicle_catalog_tables.ts`: canonical brand/series/model tables, FKs and indexes.
- `apps/api/src/db/client.ts`: Kysely table interfaces for the three canonical tables.

**Canonical import**
- `apps/api/src/reference/vehicle/catalog.types.ts`: normalized catalog DTO.
- `apps/api/src/reference/vehicle/catalog-validator.ts`: fail-closed catalog validation.
- `apps/api/src/reference/vehicle/catalog-importer.ts`: transactional upsert/deactivate behavior.
- `apps/api/src/reference/vehicle/catalog-import-cli.ts`: explicit JSON-file import CLI.
- `data/reference/vehicles/fixture.catalog.json`: small deterministic CI/dev fixture only; this is not the final Turkey catalog.

**Runtime read API**
- `apps/api/src/reference/vehicle/vehicle-catalog.repository.ts`: PostgreSQL reads for active brands/series/models and active-parent lookup.
- `apps/api/src/reference/vehicle/vehicle-catalog.service.ts`: parent-active checks and public hierarchy behavior.
- `apps/api/src/reference/vehicle/vehicle-catalog.routes.ts`: Fastify routes under `/api/v1/reference/vehicle/*`.
- `apps/api/src/app.ts`: registers vehicle reference routes when a DB is present.
- `packages/contracts/src/reference.ts`: shared vehicle response schemas.

**Tests / scripts / docs**
- `apps/api/test/vehicle-catalog-validator.test.ts`: validator unit tests.
- `apps/api/test/vehicle-catalog.integration.test.ts`: migration/import/API integration coverage.
- `apps/api/package.json`: package-level vehicle import command.
- `package.json`: root vehicle import command using existing `.env` runner.
- `.github/workflows/ci.yml`: imports deterministic fixture before the full test suite.
- `README.md`: vehicle catalog maintenance/API documentation and phase status.
- `AGENTS.md`: canonical identity and Phase A/Phase B guardrails.

---

### Task 1: Canonical vehicle schema and Kysely types

**Files:**
- Create: `apps/api/src/db/domain-migrations/0004_create_vehicle_catalog_tables.ts`
- Modify: `apps/api/src/db/client.ts`
- Create/Test: `apps/api/test/vehicle-catalog.integration.test.ts`

**Interfaces:**
- Produces DB tables: `vehicle_brands`, `vehicle_series`, `vehicle_models`.
- Produces Kysely interfaces: `VehicleBrandsTable`, `VehicleSeriesTable`, `VehicleModelsTable`.
- Later tasks depend on `Database['vehicle_brands' | 'vehicle_series' | 'vehicle_models']`.

- [ ] **Step 1: Write the failing migration/FK integration test**

Create the test harness using the same real-PostgreSQL setup as `location-reference.integration.test.ts`, then add:

```ts
describe('vehicle catalog schema', () => {
  it('creates canonical vehicle tables and enforces parent foreign keys', async () => {
    const result = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('vehicle_brands', 'vehicle_series', 'vehicle_models')
      order by table_name
    `.execute(db)

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'vehicle_brands',
      'vehicle_models',
      'vehicle_series',
    ])

    await expect(db.insertInto('vehicle_series').values({
      brand_id: '00000000-0000-0000-0000-000000000000',
      catalog_key: 'orphan:series',
      name: 'Orphan',
    }).execute()).rejects.toThrow()
  })
})
```

The shared `beforeAll` must run `migrateBootstrap`, `migrateAuth`, then `migrateDomain` exactly like the existing integration tests.

- [ ] **Step 2: Run the targeted integration test and confirm RED**

Run:

```bash
pnpm --filter @bizzat/api test:integration -- vehicle-catalog.integration.test.ts
```

If the current script does not forward a filename cleanly, run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
```

Expected: FAIL because the three tables and Kysely database members do not exist yet.

- [ ] **Step 3: Add Kysely table interfaces**

Add to `apps/api/src/db/client.ts`:

```ts
export interface VehicleBrandsTable {
  id: Generated<string>
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleSeriesTable {
  id: Generated<string>
  brand_id: string
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleModelsTable {
  id: Generated<string>
  series_id: string
  catalog_key: string
  name: string
  active: Generated<boolean>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}
```

Extend `Database`:

```ts
vehicle_brands: VehicleBrandsTable
vehicle_series: VehicleSeriesTable
vehicle_models: VehicleModelsTable
```

- [ ] **Step 4: Add migration `0004_create_vehicle_catalog_tables.ts`**

Implement PostgreSQL 18 schema with `uuidv7()` IDs:

```sql
create table if not exists vehicle_brands (
  id uuid primary key default uuidv7(),
  catalog_key text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_brands_active_name_idx
  on vehicle_brands(active, name);

create table if not exists vehicle_series (
  id uuid primary key default uuidv7(),
  brand_id uuid not null references vehicle_brands(id),
  catalog_key text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_series_brand_active_name_idx
  on vehicle_series(brand_id, active, name);

create table if not exists vehicle_models (
  id uuid primary key default uuidv7(),
  series_id uuid not null references vehicle_series(id),
  catalog_key text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_models_series_active_name_idx
  on vehicle_models(series_id, active, name);
```

`down()` drops in child-to-parent order: `vehicle_models`, `vehicle_series`, `vehicle_brands`.

- [ ] **Step 5: Run migration test and full DB integration suite**

Run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
pnpm --filter @bizzat/api test:integration
```

Expected: schema/FK test PASS; existing identity/location integration tests remain PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/client.ts \
  apps/api/src/db/domain-migrations/0004_create_vehicle_catalog_tables.ts \
  apps/api/test/vehicle-catalog.integration.test.ts
git commit -m "feat: add canonical vehicle catalog schema"
```

---

### Task 2: Canonical catalog DTO, validator, and transactional importer

**Files:**
- Create: `apps/api/src/reference/vehicle/catalog.types.ts`
- Create: `apps/api/src/reference/vehicle/catalog-validator.ts`
- Create: `apps/api/src/reference/vehicle/catalog-importer.ts`
- Create: `apps/api/test/vehicle-catalog-validator.test.ts`
- Modify/Test: `apps/api/test/vehicle-catalog.integration.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces `CanonicalVehicleCatalog`:

```ts
export interface CanonicalVehicleCatalog {
  version: string
  brands: Array<{ key: string; name: string }>
  series: Array<{ key: string; brandKey: string; name: string }>
  models: Array<{ key: string; seriesKey: string; name: string }>
}
```

- Produces `validateVehicleCatalog(catalog: CanonicalVehicleCatalog): void`.
- Produces `importVehicleCatalog(db: Kysely<Database>, catalog: CanonicalVehicleCatalog): Promise<VehicleCatalogImportResult>`.
- `VehicleCatalogImportResult` contains `{ counts: { brands; series; models } }` only; Phase A does not add source/import provenance tables.

- [ ] **Step 1: Write validator unit tests first**

Create `vehicle-catalog-validator.test.ts` with a valid base fixture and explicit failures for:

```ts
it('rejects blank version')
it('rejects duplicate brand keys')
it('rejects duplicate series keys')
it('rejects duplicate model keys')
it('rejects blank display names')
it('rejects a series whose brandKey does not exist')
it('rejects a model whose seriesKey does not exist')
```

The validator error is an internal maintenance error, not a public API error. Define:

```ts
export class VehicleCatalogValidationError extends Error {
  readonly code = 'VEHICLE_CATALOG_INVALID'
}
```

Assertions use:

```ts
expect(() => validateVehicleCatalog(value)).toThrow(VehicleCatalogValidationError)
```

- [ ] **Step 2: Run validator tests and confirm RED**

Run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog-validator.test.ts
```

Expected: FAIL because validator/types do not exist.

- [ ] **Step 3: Implement `catalog.types.ts` and `catalog-validator.ts`**

Validation rules are exact:

```text
version.trim() must be non-empty
brand key/name must be non-empty
series key/brandKey/name must be non-empty
model key/seriesKey/name must be non-empty
brand keys unique within brands
series keys unique within series
model keys unique within models
every series.brandKey exists in brands
every model.seriesKey exists in series
```

Do not infer or rewrite catalog keys in the validator. Trimming is allowed for validation/import values; key generation is repository-owned curation work.

- [ ] **Step 4: Run validator tests and confirm GREEN**

Run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog-validator.test.ts
```

Expected: all validator tests PASS.

- [ ] **Step 5: Add failing importer integration tests**

Extend `vehicle-catalog.integration.test.ts` with `makeCatalog()` containing at least:

```text
Renault -> Clio -> 1.0 TCe Joy
Renault -> Clio -> 1.0 TCe Evolution
Fiat -> Egea -> 1.4 Fire Easy
```

Add one integration test that verifies:

1. first import inserts all rows;
2. same import does not duplicate rows;
3. rename `1.0 TCe Evolution -> 1.0 TCe Evolution Updated` preserves the model UUID;
4. removing `1.0 TCe Joy` marks it inactive;
5. reintroducing it reuses the same UUID and sets `active=true`.

Add another test that mutates `series[0].brandKey = 'missing-brand'`, expects `VEHICLE_CATALOG_INVALID`, then proves the previous DB counts/active data are unchanged.

- [ ] **Step 6: Run importer integration tests and confirm RED**

Run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
```

Expected: importer tests FAIL because `importVehicleCatalog` is not implemented.

- [ ] **Step 7: Implement transactional importer**

Algorithm inside one `db.transaction().execute(...)`:

```text
validate full catalog before opening DB transaction
upsert all brands by catalog_key -> active=true
resolve brand IDs by key
upsert all series by catalog_key with resolved brand_id -> active=true
resolve series IDs by key
upsert all models by catalog_key with resolved series_id -> active=true
deactivate missing models
deactivate missing series
deactivate missing brands
return counts
```

For each upsert, update only mutable/relationship fields plus `active`/`updated_at`. Never replace IDs.

For deactivation, handle empty key arrays explicitly rather than generating `NOT IN ()`:

```ts
if (modelKeys.length === 0) {
  await trx.updateTable('vehicle_models').set({ active: false, updated_at: now }).execute()
} else {
  await trx.updateTable('vehicle_models')
    .set({ active: false, updated_at: now })
    .where('catalog_key', 'not in', modelKeys)
    .execute()
}
```

Repeat child-to-parent for series and brands.

- [ ] **Step 8: Run validator/importer/full integration tests**

Run:

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog-validator.test.ts
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
pnpm --filter @bizzat/api test:integration
```

Expected: all PASS.

- [ ] **Step 9: Add unit-test script coverage**

Update `apps/api/package.json` so the package `test` command includes both existing app/location validator tests and the new validator test. Keep integration tests in `test:integration`.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/reference/vehicle \
  apps/api/test/vehicle-catalog-validator.test.ts \
  apps/api/test/vehicle-catalog.integration.test.ts \
  apps/api/package.json
git commit -m "feat: import canonical vehicle catalog"
```

---

### Task 3: Explicit catalog CLI, deterministic fixture, and CI execution

**Files:**
- Create: `apps/api/src/reference/vehicle/catalog-import-cli.ts`
- Create: `data/reference/vehicles/fixture.catalog.json`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Package command: `reference:import:vehicle-catalog`.
- Root command: `pnpm reference:import:vehicle-catalog -- <catalog-path>`.
- CLI consumes a repository-relative JSON path and `DATABASE_URL`.
- CLI outputs JSON counts to stdout and exits non-zero on validation/read/DB failure.

- [ ] **Step 1: Add deterministic fixture JSON**

Create `data/reference/vehicles/fixture.catalog.json`:

```json
{
  "version": "fixture-1",
  "brands": [
    { "key": "fiat", "name": "Fiat" },
    { "key": "renault", "name": "Renault" },
    { "key": "volkswagen", "name": "Volkswagen" }
  ],
  "series": [
    { "key": "fiat:egea", "brandKey": "fiat", "name": "Egea" },
    { "key": "renault:clio", "brandKey": "renault", "name": "Clio" },
    { "key": "volkswagen:golf", "brandKey": "volkswagen", "name": "Golf" }
  ],
  "models": [
    { "key": "fiat:egea:1-4-fire-easy", "seriesKey": "fiat:egea", "name": "1.4 Fire Easy" },
    { "key": "renault:clio:1-0-tce-evolution", "seriesKey": "renault:clio", "name": "1.0 TCe Evolution" },
    { "key": "renault:clio:1-0-tce-joy", "seriesKey": "renault:clio", "name": "1.0 TCe Joy" },
    { "key": "volkswagen:golf:1-5-etsi-style", "seriesKey": "volkswagen:golf", "name": "1.5 eTSI Style" }
  ]
}
```

This file is test/development fixture only. Do not call it the complete Turkey catalog.

- [ ] **Step 2: Implement CLI using existing invocation-root pattern**

`catalog-import-cli.ts` parses the first non-`--` argument:

```ts
const inputPath = process.argv.slice(2).find((arg) => arg !== '--')
```

Resolve from the original pnpm invocation root:

```ts
const invocationRoot = process.env.INIT_CWD ?? process.cwd()
const raw = await readFile(resolve(invocationRoot, inputPath), 'utf8')
```

Parse JSON as `CanonicalVehicleCatalog`, create DB from `DATABASE_URL`, call `importVehicleCatalog`, print:

```ts
console.log(JSON.stringify(result))
```

Always destroy the DB in `finally`.

- [ ] **Step 3: Add package and root scripts**

In `apps/api/package.json`:

```json
"reference:import:vehicle-catalog": "tsx src/reference/vehicle/catalog-import-cli.ts"
```

In root `package.json`:

```json
"reference:import:vehicle-catalog": "node scripts/run-pnpm.mjs --filter @bizzat/api reference:import:vehicle-catalog"
```

Do not create a second env-runner script; reuse `scripts/run-pnpm.mjs`.

- [ ] **Step 4: Add CI fixture import after migrations**

In `.github/workflows/ci.yml`, directly after `Explicit migration command`, add:

```yaml
- name: Import deterministic vehicle catalog fixture
  run: pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
```

This verifies the exact documented root command on every PR.

- [ ] **Step 5: Run the root command locally/CI-equivalent**

With PostgreSQL running and migrations applied:

```bash
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
```

Expected stdout includes:

```json
{"counts":{"brands":3,"series":3,"models":4}}
```

- [ ] **Step 6: Run full verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/reference/vehicle/catalog-import-cli.ts \
  data/reference/vehicles/fixture.catalog.json \
  apps/api/package.json package.json .github/workflows/ci.yml
git commit -m "chore: add vehicle catalog import command"
```

---

### Task 4: Public brand -> series -> model API

**Files:**
- Modify: `packages/contracts/src/reference.ts`
- Create: `apps/api/src/reference/vehicle/vehicle-catalog.repository.ts`
- Create: `apps/api/src/reference/vehicle/vehicle-catalog.service.ts`
- Create: `apps/api/src/reference/vehicle/vehicle-catalog.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify/Test: `apps/api/test/vehicle-catalog.integration.test.ts`

**Interfaces:**
- Repository methods:

```ts
listBrands(): Promise<Array<{ id: string; name: string }>>
findActiveBrand(id: string): Promise<{ id: string } | undefined>
listSeries(brandId: string): Promise<Array<{ id: string; name: string }>>
findActiveSeries(id: string): Promise<{ id: string } | undefined>
listModels(seriesId: string): Promise<Array<{ id: string; name: string }>>
```

- Service methods:

```ts
listBrands()
listSeries(brandId: string)
listModels(seriesId: string)
```

- Public routes:

```text
GET /api/v1/reference/vehicle/brands
GET /api/v1/reference/vehicle/brands/:brandId/series
GET /api/v1/reference/vehicle/series/:seriesId/models
```

- [ ] **Step 1: Add shared TypeBox response schemas**

Append to `packages/contracts/src/reference.ts`:

```ts
export const ReferenceVehicleBrandSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleSeriesSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleModelSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
})

export const ReferenceVehicleBrandListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleBrandSchema),
})

export const ReferenceVehicleSeriesListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleSeriesSchema),
})

export const ReferenceVehicleModelListResponseSchema = Type.Object({
  items: Type.Array(ReferenceVehicleModelSchema),
})
```

`packages/contracts/src/index.ts` already exports `./reference.js`; do not create another contract package/module unless needed.

- [ ] **Step 2: Write failing API integration coverage**

After importing a unique catalog fixture in the test, assert:

```text
GET /reference/vehicle/brands -> active brands only
GET /reference/vehicle/brands/:brandId/series -> only active series under that active brand
GET /reference/vehicle/series/:seriesId/models -> only active models under that active series
unknown brand -> 404 REFERENCE_PARENT_NOT_FOUND
inactive brand -> 404 REFERENCE_PARENT_NOT_FOUND
unknown series -> 404 REFERENCE_PARENT_NOT_FOUND
inactive series -> 404 REFERENCE_PARENT_NOT_FOUND
response objects do not contain catalog_key
```

Use Fastify `app.inject` exactly like the location reference integration test.

- [ ] **Step 3: Run API test and confirm RED**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
```

Expected: route requests return 404 route-not-found until the new route module is registered.

- [ ] **Step 4: Implement repository**

`VehicleCatalogRepository` accepts `Kysely<Database>` and queries only `active=true` rows.

Ordering:

```text
brands: name ASC
series: name ASC within brand_id
models: name ASC within series_id
```

Public selects return only `id` and `name`.

- [ ] **Step 5: Implement service parent guards**

Before listing children:

```ts
const parent = await repository.findActiveBrand(brandId)
if (!parent) {
  throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç markası bulunamadı.')
}
```

For series:

```ts
throw new AppError(404, 'REFERENCE_PARENT_NOT_FOUND', 'Araç serisi bulunamadı.')
```

Do not introduce vehicle-specific error codes.

- [ ] **Step 6: Implement routes**

Use `FastifyPluginAsyncTypebox` and UUID param schemas. Route paths relative to `/api/v1` prefix:

```text
/reference/vehicle/brands
/reference/vehicle/brands/:brandId/series
/reference/vehicle/series/:seriesId/models
```

200 response schemas use the new contract schemas; child endpoints also declare `404: ApiErrorResponseSchema`.

- [ ] **Step 7: Register routes in `buildApp`**

Inside the existing `if (options.db)` block, keep location routes and add vehicle routes with the same `/api/v1` prefix. Do not create another server/app instance.

- [ ] **Step 8: Run API, integration, typecheck and build verification**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-catalog.integration.test.ts
pnpm test
pnpm typecheck
pnpm build
```

Expected: all PASS/exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/reference.ts \
  apps/api/src/reference/vehicle/vehicle-catalog.repository.ts \
  apps/api/src/reference/vehicle/vehicle-catalog.service.ts \
  apps/api/src/reference/vehicle/vehicle-catalog.routes.ts \
  apps/api/src/app.ts \
  apps/api/test/vehicle-catalog.integration.test.ts
git commit -m "feat: expose canonical vehicle reference API"
```

---

### Task 5: Documentation, CI gate, and Phase A completion review

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Verify: `.github/workflows/ci.yml`
- Verify: all Phase A files/diff against spec.

**Interfaces:**
- Documents the Phase A public API and maintenance command.
- Explicitly states Phase B remains TSB/source ingestion + mapping + real Turkey catalog population.

- [ ] **Step 1: Update README maintenance/runtime docs**

Add a `Vehicle catalog` subsection with:

```text
Canonical identity is Bizzat-owned brand/series/model UUIDs.
Runtime reads PostgreSQL only.
Fixture import command:
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
Public endpoints:
GET /api/v1/reference/vehicle/brands
GET /api/v1/reference/vehicle/brands/:brandId/series
GET /api/v1/reference/vehicle/series/:seriesId/models
The fixture is not the complete Turkey catalog.
TSB/source mapping and real Turkey population are the next Phase B.
```

Update the current-stage row so it does not claim Phase B is already complete.

- [ ] **Step 2: Update AGENTS guardrails**

Add exact rules:

```text
vehicle_brands/vehicle_series/vehicle_models are Bizzat canonical identity
catalog_key is stable; display renames must not change identity
model year stays outside canonical taxonomy
TSB/provider IDs must never become listing domain IDs
Phase A must not grow source-provider/mapping/spec/engine/generation tables
vehicle reference runtime must not call external APIs
```

- [ ] **Step 3: Run fresh full verification before completion claim**

Run the exact merge gate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bizzat/api db:migrate:raw
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

Expected: every command exits 0. Record test counts from the output before claiming completion.

- [ ] **Step 4: Review the complete branch against Phase A scope**

Compare `main...HEAD` and verify:

```text
YES: vehicle_brands / vehicle_series / vehicle_models
YES: canonical JSON validator/importer/CLI
YES: fixture + public API + tests + docs/CI
NO: vehicle_model_years
NO: vehicle_source_* tables
NO: TSB ingestion/mapping
NO: OtoAPI/runtime external API
NO: generation/engine/trim/spec tables
NO: Redis/search/cache/queue/service additions
```

Any scope leak is removed before PR approval.

- [ ] **Step 5: Commit docs/final gate changes**

```bash
git add README.md AGENTS.md .github/workflows/ci.yml
git commit -m "docs: document vehicle catalog foundation"
```

- [ ] **Step 6: PR and merge criteria**

Open the Phase A PR only after the branch-level checks pass. Merge only after the PR-triggered permanent CI passes with frozen lockfile, explicit migration, deterministic vehicle fixture import, all tests, build, and Next standalone verification.

After merge, Phase B begins from fresh `main` and gets its own implementation plan for TSB/provider ingestion, mapping review, and initial Turkey catalog population.
