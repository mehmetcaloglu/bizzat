# Location Reference Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-hosted Turkish province/district/neighborhood reference data with explicit import tooling and public read-only hierarchy endpoints.

**Architecture:** Keep normal reads entirely inside PostgreSQL. Import a pinned snapshot through an API-internal normalizer/validator/importer, track provider and import provenance separately, upsert by provider-scoped source keys, and deactivate missing rows instead of deleting them. Public response schemas live in `packages/contracts`; source-specific import DTOs remain inside `apps/api`.

**Tech Stack:** Node 24 LTS, TypeScript, Fastify, Kysely, PostgreSQL 18, Vitest, pnpm workspace, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-08-location-reference-data-design.md`

## Global Constraints

- Normal application requests must not call an external location API.
- API startup and deploy must not run location imports automatically.
- Runtime source of truth is PostgreSQL 18.
- Keep provider identity separate from individual import versions/checksums.
- Upsert location rows by provider-scoped stable source key, never display name alone.
- Missing rows in a new snapshot become `active = false`; do not hard-delete them.
- The public phase exposes only province -> district -> neighborhood hierarchy reads.
- No Redis, queue, Elasticsearch, replica, partitioning, GIS, geocoding, postal-code, fuzzy-search, or admin UI work in this phase.
- DB/import behavior must be verified against real PostgreSQL 18 integration tests.
- CI remains frozen-lockfile + explicit migrations + lint + typecheck + tests + build.

---

## File Map

### Database and import infrastructure

- Create `apps/api/src/db/domain-migrations/0003_create_location_reference_tables.ts` — provider/import/location tables, constraints, indexes.
- Modify `apps/api/src/db/client.ts` — typed Kysely table interfaces for reference data.
- Create `apps/api/src/reference/import/location-import.types.ts` — source-agnostic internal import DTOs.
- Create `apps/api/src/reference/import/location-validator.ts` — fail-closed hierarchy validation.
- Create `apps/api/src/reference/import/location-checksum.ts` — deterministic normalized payload checksum.
- Create `apps/api/src/reference/import/location-importer.ts` — transactional provider/import/upsert/deactivate logic.
- Create `apps/api/src/reference/import/import-cli.ts` — explicit maintenance command only.
- Modify `apps/api/package.json` and root `package.json` — `reference:import:locations` command wiring.

### Public reference API

- Create `packages/contracts/src/reference.ts` — public response schemas/types.
- Modify `packages/contracts/src/index.ts` — exports.
- Create `apps/api/src/reference/location.repository.ts` — PostgreSQL reads only.
- Create `apps/api/src/reference/location.service.ts` — parent existence/active rules.
- Create `apps/api/src/reference/location.routes.ts` — `/api/v1/reference/*` routes.
- Modify `apps/api/src/app.ts` — register reference routes.

### Snapshot and documentation

- Create `data/reference/locations/fixture.locations.json` — deterministic small CI/test fixture.
- Create `data/reference/locations/source-manifest.json` — pinned operational source metadata/checksum placeholder populated with the inspected source version used by implementation.
- Modify `README.md` and `AGENTS.md` — explicit import/read-path rules and commands.

### Tests

- Create `apps/api/test/location-reference.integration.test.ts` — migration/import/idempotency/deactivation/rollback/FK/API coverage against PostgreSQL 18.
- Create `apps/api/test/location-validator.test.ts` — unit validation/checksum behavior.

---

### Task 1: Location reference schema and typed DB model

**Files:**
- Create: `apps/api/src/db/domain-migrations/0003_create_location_reference_tables.ts`
- Modify: `apps/api/src/db/client.ts`
- Test: `apps/api/test/location-reference.integration.test.ts`

**Interfaces:**
- Produces tables: `reference_data_providers`, `reference_data_imports`, `provinces`, `districts`, `neighborhoods`.
- Produces Kysely interfaces with those exact table names.
- Later tasks rely on `provider_id + source_key` uniqueness for stable upserts.

- [ ] **Step 1: Write the failing migration test**

Add an integration test that runs the existing explicit migration command, then asserts:

```ts
const tables = await sql<{ table_name: string }>`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'reference_data_providers',
      'reference_data_imports',
      'provinces',
      'districts',
      'neighborhoods'
    )
`.execute(db)

expect(tables.rows.map((row) => row.table_name).sort()).toEqual([
  'districts',
  'neighborhoods',
  'provinces',
  'reference_data_imports',
  'reference_data_providers',
])
```

Also assert that inserting a district with a nonexistent `province_id` fails and invalid province code duplicates are rejected for active rows.

- [ ] **Step 2: Run the migration integration test and verify failure**

Run:

```bash
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
```

Expected: FAIL because the reference tables do not exist.

- [ ] **Step 3: Implement the migration**

Create the tables with these required fields:

```text
reference_data_providers:
  id uuid PK default uuidv7()
  code text UNIQUE NOT NULL
  source_name text NOT NULL
  source_url text NULL
  license text NULL
  created_at timestamptz NOT NULL default now()

reference_data_imports:
  id uuid PK default uuidv7()
  provider_id uuid FK -> reference_data_providers(id)
  version text NOT NULL
  checksum_sha256 text NOT NULL
  imported_at timestamptz NOT NULL default now()
  UNIQUE(provider_id, version, checksum_sha256)

provinces:
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  code text NOT NULL
  name text NOT NULL
  active boolean NOT NULL default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)

districts:
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  province_id uuid FK -> provinces(id)
  name text NOT NULL
  active boolean NOT NULL default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)

neighborhoods:
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  district_id uuid FK -> districts(id)
  name text NOT NULL
  kind text NULL
  active boolean NOT NULL default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)
```

Add indexes:

```text
provinces(active, code, name)
districts(province_id, active, name)
neighborhoods(district_id, active, name)
```

Use a partial unique index for active province code:

```sql
create unique index provinces_active_code_uidx
on provinces(code)
where active = true;
```

- [ ] **Step 4: Update Kysely table interfaces**

Add exact interfaces for the five tables in `apps/api/src/db/client.ts`, using `Generated<string>` for UUID/default-generated ID columns if that matches the existing style.

- [ ] **Step 5: Run migration integration tests**

Run:

```bash
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
pnpm --filter @bizzat/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db apps/api/test/location-reference.integration.test.ts
git commit -m "feat: add location reference schema"
```

---

### Task 2: Source-agnostic validation and deterministic checksum

**Files:**
- Create: `apps/api/src/reference/import/location-import.types.ts`
- Create: `apps/api/src/reference/import/location-validator.ts`
- Create: `apps/api/src/reference/import/location-checksum.ts`
- Test: `apps/api/test/location-validator.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LocationProviderMeta {
  code: string
  sourceName: string
  sourceUrl?: string
  license?: string
  version: string
}

export interface ImportProvince {
  sourceKey: string
  code: string
  name: string
}

export interface ImportDistrict {
  sourceKey: string
  provinceSourceKey: string
  name: string
}

export interface ImportNeighborhood {
  sourceKey: string
  districtSourceKey: string
  name: string
  kind?: string
}

export interface NormalizedLocationSnapshot {
  provider: LocationProviderMeta
  provinces: ImportProvince[]
  districts: ImportDistrict[]
  neighborhoods: ImportNeighborhood[]
}
```

- Produces:

```ts
export function validateLocationSnapshot(snapshot: NormalizedLocationSnapshot): void
export function checksumLocationSnapshot(snapshot: NormalizedLocationSnapshot): string
```

- [ ] **Step 1: Write failing unit tests**

Cover exactly:

1. duplicate province `sourceKey` throws `LOCATION_SNAPSHOT_INVALID`;
2. duplicate active province `code` throws;
3. orphan district throws;
4. orphan neighborhood throws;
5. whitespace-only names throw;
6. empty provider `code/version/sourceName` throws;
7. checksum is identical for semantically identical snapshots even if array insertion order differs.

Use `AppError` if the existing common error model is available; otherwise export a small `LocationSnapshotValidationError` with stable `.code = 'LOCATION_SNAPSHOT_INVALID'`.

- [ ] **Step 2: Run unit test and verify failure**

```bash
pnpm --filter @bizzat/api test -- location-validator.test.ts
```

Expected: FAIL because validator/checksum do not exist.

- [ ] **Step 3: Implement normalization-safe validation**

Trim string values before validation, but do not mutate caller objects. Validate hierarchy using `Set` lookups. Require at least one province, one district, and one neighborhood for operational snapshots.

- [ ] **Step 4: Implement deterministic checksum**

Build a canonical JSON object where provinces/districts/neighborhoods are copied and sorted by `sourceKey`, then compute:

```ts
createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
```

Do not include `importedAt` or any runtime timestamp.

- [ ] **Step 5: Run unit tests and typecheck**

```bash
pnpm --filter @bizzat/api test -- location-validator.test.ts
pnpm --filter @bizzat/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/reference/import apps/api/test/location-validator.test.ts
git commit -m "feat: validate location snapshots"
```

---

### Task 3: Transactional importer with idempotency and deactivation

**Files:**
- Create: `apps/api/src/reference/import/location-importer.ts`
- Test: `apps/api/test/location-reference.integration.test.ts`

**Interfaces:**
- Consumes `NormalizedLocationSnapshot`, `validateLocationSnapshot`, `checksumLocationSnapshot`.
- Produces:

```ts
export interface LocationImportResult {
  providerId: string
  importId: string
  checksum: string
  counts: {
    provinces: number
    districts: number
    neighborhoods: number
  }
}

export async function importLocationSnapshot(
  db: Kysely<Database>,
  snapshot: NormalizedLocationSnapshot,
): Promise<LocationImportResult>
```

- [ ] **Step 1: Write failing integration tests**

Add tests against real PostgreSQL 18 for:

```text
first import inserts provider/import + hierarchy
same snapshot twice does not duplicate location rows
renaming a district with same sourceKey updates same row id
second snapshot missing a neighborhood sets it inactive
reintroduced neighborhood with same sourceKey reactivates same row id
invalid/orphan snapshot leaves previous working data unchanged
```

Capture row IDs before rename/deactivate/reactivate and assert stability.

- [ ] **Step 2: Run integration test and verify failure**

```bash
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
```

Expected: FAIL because importer does not exist.

- [ ] **Step 3: Implement provider/import persistence**

Inside one `db.transaction().execute(...)`:

1. validate snapshot before opening the transaction;
2. checksum normalized payload;
3. upsert `reference_data_providers` by `code`, updating source metadata;
4. insert/find `reference_data_imports` by `(provider_id, version, checksum)`.

- [ ] **Step 4: Implement stable upserts**

For every hierarchy level, upsert on `(provider_id, source_key)` and update mutable display fields + parent FK + `active = true` + `updated_at = now()`.

Resolve child parent IDs from the rows imported/upserted in the same transaction; never look up parents by display name.

- [ ] **Step 5: Implement deactivate-missing**

After all upserts, run provider-scoped updates:

```text
provinces active=false where provider_id matches and source_key not in current province keys
districts active=false where provider_id matches and source_key not in current district keys
neighborhoods active=false where provider_id matches and source_key not in current neighborhood keys
```

Do this in child-to-parent order: neighborhoods, districts, provinces.

- [ ] **Step 6: Run importer integration tests**

```bash
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
pnpm --filter @bizzat/api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/reference/import/location-importer.ts apps/api/test/location-reference.integration.test.ts
git commit -m "feat: import location reference data"
```

---

### Task 4: Explicit CLI and deterministic fixture/manifest

**Files:**
- Create: `apps/api/src/reference/import/import-cli.ts`
- Create: `data/reference/locations/fixture.locations.json`
- Create: `data/reference/locations/source-manifest.json`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Test: `apps/api/test/location-reference.integration.test.ts`

**Interfaces:**
- Produces maintenance command:

```bash
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
```

- Fixture file shape must deserialize directly to `NormalizedLocationSnapshot`.

- [ ] **Step 1: Add fixture-loader integration test**

Use a deterministic fixture containing at minimum:

```text
2 provinces
3 districts
4 neighborhoods
```

Include Istanbul/Güngören/Haznedar-like test names only as public administrative examples; no user address or private data.

Test reads JSON from disk, imports it, and asserts the count result.

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because fixture/CLI do not exist.

- [ ] **Step 3: Add the fixture and source manifest**

`fixture.locations.json` contains test-only normalized data.

`source-manifest.json` records the chosen operational provider fields:

```json
{
  "code": "turkey-geo-api",
  "sourceName": "Turkey Geo API location snapshot",
  "sourceUrl": "https://github.com/...",
  "license": "MIT",
  "version": "<pinned release/date>",
  "notes": "Operational snapshot; not an official NVI mirror."
}
```

Populate the exact source URL/version from the inspected upstream repository before committing; do not write `TBD`.

- [ ] **Step 4: Implement CLI**

CLI behavior:

```text
require one file path argument
read UTF-8 JSON
parse to unknown
validate shape via validateLocationSnapshot
open existing DB client using DATABASE_URL
call importLocationSnapshot
print only non-sensitive summary/counts/checksum
close DB cleanly
exit non-zero on failure
```

Do not fetch remote URLs in this command in the first implementation.

- [ ] **Step 5: Wire scripts**

API package:

```json
"reference:import:locations": "tsx src/reference/import/import-cli.ts"
```

Root:

```json
"reference:import:locations": "node scripts/run-pnpm.mjs --filter @bizzat/api reference:import:locations --"
```

Follow existing root script conventions exactly if the extra `--` is unnecessary in the current runner.

- [ ] **Step 6: Verify CLI against fixture**

With local/CI PostgreSQL migrated:

```bash
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
```

Expected output includes the checksum and counts `2/3/4`; second run succeeds without duplicate rows.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/reference/import/import-cli.ts data/reference/locations package.json apps/api/package.json apps/api/test/location-reference.integration.test.ts
git commit -m "feat: add location import command"
```

---

### Task 5: Shared contracts and read-only hierarchy API

**Files:**
- Create: `packages/contracts/src/reference.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/reference/location.repository.ts`
- Create: `apps/api/src/reference/location.service.ts`
- Create: `apps/api/src/reference/location.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/location-reference.integration.test.ts`

**Interfaces:**
- Produces contracts:

```ts
ReferenceProvinceSchema = { id: string; code: string; name: string }
ReferenceDistrictSchema = { id: string; name: string }
ReferenceNeighborhoodSchema = { id: string; name: string; kind?: string | null }
ReferenceListResponseSchema<T> = { items: T[] }
```

- Produces routes:

```text
GET /api/v1/reference/provinces
GET /api/v1/reference/provinces/:provinceId/districts
GET /api/v1/reference/districts/:districtId/neighborhoods
```

- [ ] **Step 1: Write failing API integration tests**

Seed through `importLocationSnapshot`, then assert:

1. provinces returns only active rows sorted by code/name;
2. districts returns only active children for specified active province;
3. neighborhoods returns only active children for specified active district;
4. inactive/unknown province returns common `404` error;
5. inactive/unknown district returns common `404` error;
6. no endpoint leaks `provider_id`, `source_key`, checksum, or source metadata.

- [ ] **Step 2: Run API integration tests and verify failure**

```bash
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
```

Expected: FAIL with route-not-found.

- [ ] **Step 3: Add contracts**

Use TypeBox patterns already present in `packages/contracts`. Export both runtime schema and inferred TS types.

- [ ] **Step 4: Implement repository**

Exact methods:

```ts
listActiveProvinces(): Promise<ReferenceProvince[]>
findActiveProvinceById(id: string): Promise<{ id: string } | null>
listActiveDistricts(provinceId: string): Promise<ReferenceDistrict[]>
findActiveDistrictById(id: string): Promise<{ id: string } | null>
listActiveNeighborhoods(districtId: string): Promise<ReferenceNeighborhood[]>
```

No import/provider logic belongs in this repository.

- [ ] **Step 5: Implement service**

Service checks active parent existence before child reads and throws:

```ts
new AppError('REFERENCE_PARENT_NOT_FOUND', 'Konum bulunamadı.', 404)
```

Reuse the project common error constructor signature exactly; adjust positional args only to match existing code.

- [ ] **Step 6: Implement routes and register them**

Use Fastify TypeBox response schemas. Do not add auth requirement: these are public read-only MVP endpoints.

- [ ] **Step 7: Run contracts/API/type checks**

```bash
pnpm contracts:build
pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/contracts apps/api/src/reference apps/api/src/app.ts apps/api/test/location-reference.integration.test.ts
git commit -m "feat: expose location reference API"
```

---

### Task 6: Permanent CI/docs integration and whole-branch verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.github/workflows/ci.yml` only if an explicit new fixture/import verification step is needed beyond existing migration/tests.

**Interfaces:**
- Documents the operational command and guardrails for future agents.
- Existing CI remains the merge gate.

- [ ] **Step 1: Update README**

Document:

```bash
pnpm db:up
pnpm db:migrate
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm dev
```

State clearly that the fixture is for development/testing and production reference imports use a reviewed pinned snapshot, not live runtime fetching.

- [ ] **Step 2: Update AGENTS guardrails**

Add rules:

```text
location reads come from PostgreSQL
imports are explicit maintenance operations
never import on API startup/deploy
provider identity and import-version provenance are separate
never match administrative records by display name alone
missing entities are deactivated, not deleted
vehicle reference data remains a separate subsystem/PR
```

- [ ] **Step 3: Add CI command coverage if missing**

If integration tests already load/import the fixture and run under permanent CI, do not add a redundant workflow step.

If they do not, add one explicit step after migrations:

```bash
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
```

Do not allow CI to fetch the live upstream source.

- [ ] **Step 4: Run complete verification**

Permanent equivalent:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

Expected: all PASS against PostgreSQL 18.

- [ ] **Step 5: Whole-diff review**

Check `main...HEAD` for:

```text
no vehicle catalog work
no runtime external HTTP location calls
no startup import
no user/private address data
no Redis/search/cache infrastructure
no hard-delete of disappeared location rows
no leaked source metadata in public API
```

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md .github/workflows/ci.yml
git commit -m "docs: document location reference workflow"
```

- [ ] **Step 7: Open PR and require permanent CI**

PR summary must explicitly list migration/import/API coverage and state that runtime has zero external location-service dependency.

Merge only after PR-triggered permanent CI passes frozen-lockfile, migration, tests, lint, typecheck, and build.
