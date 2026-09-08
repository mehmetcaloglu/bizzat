# Location Reference Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-hosted Turkish province/district/neighborhood reference data with explicit import tooling and public read-only hierarchy endpoints.

**Architecture:** PostgreSQL is the runtime source of truth. Imports are explicit maintenance operations that validate a pinned normalized snapshot, record provider/import provenance separately, upsert by provider-scoped source keys, and deactivate missing rows instead of deleting them. Public contracts stay in `packages/contracts`; source/import DTOs remain API-internal.

**Tech Stack:** Node 24 LTS, TypeScript, Fastify, Kysely, PostgreSQL 18, Vitest, pnpm, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-08-location-reference-data-design.md`

## Global Constraints

- No external location API calls in normal runtime reads.
- No startup/deploy import.
- No Redis, queue, Elasticsearch, GIS, geocoding, fuzzy search, partitioning, replica, or admin UI.
- Provider identity and individual import versions/checksums are separate records.
- Location identity is `(provider_id, source_key)`, never display name alone.
- Missing rows become inactive; no hard delete.
- Real PostgreSQL 18 integration tests are required.
- Vehicle catalog work is out of scope.
- Operational source metadata is pinned to `onurusluca/turkey-geo-api` commit `5a16cef20f2335e3fe643c9618f931866bb8134c` (`version 1.3`, 2026-04-14), MIT licensed. It is an operational snapshot, not an official NVI mirror.

---

### Task 1: Database schema

**Files**
- Create `apps/api/src/db/domain-migrations/0003_create_location_reference_tables.ts`
- Modify `apps/api/src/db/client.ts`
- Create `apps/api/test/location-reference.integration.test.ts`

**Tables**

```text
reference_data_providers
  id uuid PK default uuidv7()
  code text UNIQUE NOT NULL
  source_name text NOT NULL
  source_url text NULL
  license text NULL
  created_at timestamptz default now()

reference_data_imports
  id uuid PK default uuidv7()
  provider_id uuid FK
  version text NOT NULL
  checksum_sha256 text NOT NULL
  imported_at timestamptz default now()
  UNIQUE(provider_id, version, checksum_sha256)

provinces
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  code text NOT NULL
  name text NOT NULL
  active boolean default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)

districts
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  province_id uuid FK
  name text NOT NULL
  active boolean default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)

neighborhoods
  id uuid PK default uuidv7()
  provider_id uuid FK
  source_key text NOT NULL
  district_id uuid FK
  name text NOT NULL
  kind text NULL
  active boolean default true
  created_at/updated_at timestamptz
  UNIQUE(provider_id, source_key)
```

Indexes:

```text
UNIQUE provinces(code) WHERE active=true
provinces(active, code, name)
districts(province_id, active, name)
neighborhoods(district_id, active, name)
```

- [ ] Write failing integration test for table existence, FK enforcement, and active province-code uniqueness.
- [ ] Run `pnpm --filter @bizzat/api test:integration -- location-reference.integration.test.ts` and verify failure.
- [ ] Implement migration and Kysely interfaces.
- [ ] Re-run integration test and typecheck; expect PASS.
- [ ] Commit `feat: add location reference schema`.

---

### Task 2: Snapshot types, validation, checksum

**Files**
- Create `apps/api/src/reference/import/location-import.types.ts`
- Create `apps/api/src/reference/import/location-validator.ts`
- Create `apps/api/src/reference/import/location-checksum.ts`
- Create `apps/api/test/location-validator.test.ts`

**Interfaces**

```ts
export interface LocationProviderMeta {
  code: string
  sourceName: string
  sourceUrl?: string
  license?: string
  version: string
}

export interface ImportProvince { sourceKey: string; code: string; name: string }
export interface ImportDistrict { sourceKey: string; provinceSourceKey: string; name: string }
export interface ImportNeighborhood { sourceKey: string; districtSourceKey: string; name: string; kind?: string }

export interface NormalizedLocationSnapshot {
  provider: LocationProviderMeta
  provinces: ImportProvince[]
  districts: ImportDistrict[]
  neighborhoods: ImportNeighborhood[]
}

export function validateLocationSnapshot(snapshot: NormalizedLocationSnapshot): void
export function checksumLocationSnapshot(snapshot: NormalizedLocationSnapshot): string
```

Validation must reject duplicate source keys, duplicate province codes, orphan children, empty/whitespace names, empty provider metadata, and empty hierarchy levels. Stable error code: `LOCATION_SNAPSHOT_INVALID`.

Checksum must canonicalize arrays by `sourceKey`, then SHA-256 `JSON.stringify(canonical)`; runtime timestamps are excluded.

- [ ] Write failing tests for all validation rules and order-independent checksum.
- [ ] Run unit test and verify failure.
- [ ] Implement minimal validator/checksum.
- [ ] Re-run unit tests and typecheck; expect PASS.
- [ ] Commit `feat: validate location snapshots`.

---

### Task 3: Transactional importer

**Files**
- Create `apps/api/src/reference/import/location-importer.ts`
- Extend `apps/api/test/location-reference.integration.test.ts`

**Interface**

```ts
export interface LocationImportResult {
  providerId: string
  importId: string
  checksum: string
  counts: { provinces: number; districts: number; neighborhoods: number }
}

export async function importLocationSnapshot(
  db: Kysely<Database>,
  snapshot: NormalizedLocationSnapshot,
): Promise<LocationImportResult>
```

Behavior:

1. validate before transaction;
2. compute checksum;
3. upsert provider by `code`;
4. insert/find import record by provider/version/checksum;
5. upsert province/district/neighborhood rows by `(provider_id, source_key)`;
6. update mutable name/code/kind/parent fields and reactivate rows;
7. deactivate provider rows absent from current snapshot in child-to-parent order;
8. commit atomically.

- [ ] Write failing real-DB tests for first import, same-snapshot idempotency, rename with stable ID, deactivate, reactivate with same ID, and rollback on invalid snapshot.
- [ ] Implement importer.
- [ ] Re-run integration tests and typecheck; expect PASS.
- [ ] Commit `feat: import location reference data`.

---

### Task 4: Explicit CLI and deterministic data files

**Files**
- Create `apps/api/src/reference/import/import-cli.ts`
- Create `data/reference/locations/fixture.locations.json`
- Create `data/reference/locations/source-manifest.json`
- Modify `apps/api/package.json`
- Modify root `package.json`
- Extend integration tests.

`source-manifest.json` must contain exactly this operational provenance:

```json
{
  "code": "turkey-geo-api",
  "sourceName": "Turkey Geo API location snapshot",
  "sourceUrl": "https://github.com/onurusluca/turkey-geo-api",
  "license": "MIT",
  "version": "1.3@5a16cef20f2335e3fe643c9618f931866bb8134c",
  "sourceDate": "2026-04-14",
  "notes": "Operational snapshot; not an official NVI mirror."
}
```

Fixture contains 2 provinces, 3 districts, 4 neighborhoods and no private/user data.

Command:

```bash
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
```

CLI reads one JSON file, validates, imports through the normal importer, prints only checksum/counts, closes DB, and exits non-zero on failure. It does not fetch remote URLs.

- [ ] Add failing fixture-loader integration test.
- [ ] Add fixture + manifest.
- [ ] Implement CLI and package scripts.
- [ ] Run command twice and assert no duplicate rows.
- [ ] Commit `feat: add location import command`.

---

### Task 5: Public read-only API and shared contracts

**Files**
- Create `packages/contracts/src/reference.ts`
- Modify `packages/contracts/src/index.ts`
- Create `apps/api/src/reference/location.repository.ts`
- Create `apps/api/src/reference/location.service.ts`
- Create `apps/api/src/reference/location.routes.ts`
- Modify `apps/api/src/app.ts`
- Extend `apps/api/test/location-reference.integration.test.ts`

Routes:

```text
GET /api/v1/reference/provinces
GET /api/v1/reference/provinces/:provinceId/districts
GET /api/v1/reference/districts/:districtId/neighborhoods
```

Public shapes:

```ts
{ id: string, code: string, name: string }
{ id: string, name: string }
{ id: string, name: string, kind?: string | null }
{ items: T[] }
```

Repository methods:

```ts
listActiveProvinces()
findActiveProvinceById(id)
listActiveDistricts(provinceId)
findActiveDistrictById(id)
listActiveNeighborhoods(districtId)
```

Service must return `REFERENCE_PARENT_NOT_FOUND` / HTTP 404 for unknown or inactive parent. Endpoints are public and must not expose provider/source/import metadata.

- [ ] Write failing API integration tests for filtering, ordering, parent scoping, 404s, and no metadata leakage.
- [ ] Implement contracts, repository, service, routes, app registration.
- [ ] Run contracts build, integration tests, typecheck, lint; expect PASS.
- [ ] Commit `feat: expose location reference API`.

---

### Task 6: Docs, CI, whole-branch verification

**Files**
- Modify `README.md`
- Modify `AGENTS.md`
- Modify `.github/workflows/ci.yml` only if existing integration tests do not already exercise fixture import.

Document:

```bash
pnpm db:up
pnpm db:migrate
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm dev
```

Guardrails to add:

```text
reads always use PostgreSQL
imports are explicit maintenance operations
never import on startup/deploy
provider identity != import version
never match by display name alone
missing records are deactivated
vehicle reference data stays separate
```

Final verification:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

Whole-diff review must confirm no vehicle catalog work, no runtime HTTP fetch, no startup import, no private address data, no Redis/search/cache infrastructure, no hard delete, and no source metadata leakage.

- [ ] Update docs and CI only as needed.
- [ ] Run full verification against PostgreSQL 18.
- [ ] Review `main...HEAD` scope.
- [ ] Commit `docs: document location reference workflow`.
- [ ] Open PR; merge only after PR-triggered permanent CI passes frozen install, explicit migrations, tests, lint, typecheck, and build.
