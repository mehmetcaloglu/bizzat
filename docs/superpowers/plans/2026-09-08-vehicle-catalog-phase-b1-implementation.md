# Vehicle Catalog Phase B1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add maintenance-only TSB source ingestion, reviewed mapping application, and deterministic coverage reporting around the existing Bizzat canonical automobile catalog.

**Architecture:** B1 starts from a normalized JSON boundary; raw TSB exports remain outside the public repository and product runtime. PostgreSQL stores provider/import provenance, one source row per TSB vehicle code, reviewed mappings to existing Bizzat `vehicle_models`, and review state. Runtime public vehicle endpoints remain unchanged and continue reading canonical tables only.

**Tech Stack:** Node.js 24 LTS, TypeScript 6, Fastify codebase conventions, Kysely, PostgreSQL 18, Vitest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md`

## Global Constraints

- B1 source identity for TSB is exactly one row per trimmed `Araç Kodu`; model year is metadata and never part of `source_key`.
- `available_model_years` is sorted unique metadata only and never a listing-validity gate.
- Empty TSB snapshots fail closed before a DB transaction.
- Raw TSB spreadsheet/export files and TSB kasko prices are not committed or persisted.
- Normal runtime, API startup, deploy, and migration perform zero TSB/provider HTTP calls.
- Source imports never create or rename canonical `vehicle_brands`, `vehicle_series`, or `vehicle_models`.
- Mapping files use TSB source code + Bizzat `vehicle_models.catalog_key`, never DB UUIDs.
- Source imports may set `mapping_needs_review=true`; only explicit mapping apply/confirm may clear it.
- Inactive canonical mapping targets are reported as invalid and cannot be newly applied.
- Mapping files are patch/apply artifacts; absence from a file never deletes an unrelated mapping.
- No fuzzy search, numeric confidence, LLM mapping, Redis, search service, queue, worker, microservice, or scheduled sync is introduced.
- All DB behavior is covered against real PostgreSQL 18.
- B2 brand/series aliases, candidate generation, real Turkey `catalog.json`, and large curation work are explicitly out of scope.

---

## File Map

**Database**
- `apps/api/src/db/domain-migrations/0005_create_vehicle_source_tables.ts`: B1 provider/import/source/mapping tables and indexes.
- `apps/api/src/db/client.ts`: Kysely interfaces and `VehicleMappingMethod` type.

**TSB normalized source ingestion**
- `apps/api/src/reference/vehicle/source/source.types.ts`: runtime-normalized source DTOs and import result types.
- `apps/api/src/reference/vehicle/source/source-normalization.ts`: deterministic comparison normalization and year normalization.
- `apps/api/src/reference/vehicle/source/source-validator.ts`: `unknown` -> validated normalized TSB snapshot assertion.
- `apps/api/src/reference/vehicle/source/source-checksum.ts`: fixed-order logical SHA-256.
- `apps/api/src/reference/vehicle/source/source-importer.ts`: transactional provenance/upsert/deactivate/stale-mapping logic.

**Reviewed mappings and reports**
- `apps/api/src/reference/vehicle/source/mapping.types.ts`: mapping-file DTO.
- `apps/api/src/reference/vehicle/source/mapping-validator.ts`: runtime mapping-file validation.
- `apps/api/src/reference/vehicle/source/mapping-service.ts`: transactional apply/confirm behavior.
- `apps/api/src/reference/vehicle/source/source-report.ts`: deterministic trusted/unmapped/review-required/invalid report.

**CLI / fixtures**
- `apps/api/src/reference/vehicle/source/source-import-cli.ts`
- `apps/api/src/reference/vehicle/source/mapping-apply-cli.ts`
- `apps/api/src/reference/vehicle/source/source-report-cli.ts`
- `data/reference/vehicles/fixture.tsb-source.json`: invented normalized TSB-like CI/dev fixture only.
- `data/reference/vehicles/fixture.tsb-mappings.json`: reviewed-style mapping fixture referencing Phase A canonical fixture keys.

**Tests / scripts / docs**
- `apps/api/test/vehicle-source-validator.test.ts`
- `apps/api/test/vehicle-source.integration.test.ts`
- `apps/api/package.json`
- `package.json`
- `.github/workflows/ci.yml`
- `README.md`
- `AGENTS.md`

---

### Task 1: Source provenance and mapping schema

**Files:**
- Create: `apps/api/src/db/domain-migrations/0005_create_vehicle_source_tables.ts`
- Modify: `apps/api/src/db/client.ts`
- Create/Test: `apps/api/test/vehicle-source.integration.test.ts`

**Interfaces:**
- Produces tables: `vehicle_source_providers`, `vehicle_source_imports`, `vehicle_source_records`, `vehicle_source_mappings`.
- Produces `VehicleMappingMethod = 'manual' | 'exact-rule' | 'curated-import'`.
- Produces Kysely interfaces: `VehicleSourceProvidersTable`, `VehicleSourceImportsTable`, `VehicleSourceRecordsTable`, `VehicleSourceMappingsTable`.

- [ ] **Step 1: Write the failing migration/FK integration test**

Use the same PostgreSQL/auth/domain migration harness as `vehicle-catalog.integration.test.ts`. Assert the four tables exist, then prove a source record cannot reference a non-existent provider/import and a mapping cannot reference a non-existent canonical model.

Core assertions:

```ts
const result = await sql<{ table_name: string }>`
  select table_name from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'vehicle_source_providers',
      'vehicle_source_imports',
      'vehicle_source_records',
      'vehicle_source_mappings'
    )
  order by table_name
`.execute(db)

expect(result.rows.map((row) => row.table_name)).toEqual([
  'vehicle_source_imports',
  'vehicle_source_mappings',
  'vehicle_source_providers',
  'vehicle_source_records',
])
```

- [ ] **Step 2: Run the targeted test and confirm RED**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source.integration.test.ts
```

Expected: FAIL because the B1 tables/types do not exist.

- [ ] **Step 3: Add Kysely types**

Add to `apps/api/src/db/client.ts`:

```ts
export type VehicleMappingMethod = 'manual' | 'exact-rule' | 'curated-import'

export interface VehicleSourceProvidersTable {
  id: Generated<string>
  code: string
  source_name: string
  source_url: string | null
  license: string | null
  created_at: Generated<Date>
}

export interface VehicleSourceImportsTable {
  id: Generated<string>
  provider_id: string
  version: string
  checksum_sha256: string
  imported_at: Generated<Date>
}

export interface VehicleSourceRecordsTable {
  id: Generated<string>
  provider_id: string
  source_key: string
  brand_raw: string
  type_raw: string
  available_model_years: number[]
  active: Generated<boolean>
  mapping_needs_review: Generated<boolean>
  first_seen_import_id: string
  last_seen_import_id: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface VehicleSourceMappingsTable {
  source_record_id: string
  vehicle_model_id: string
  mapping_method: VehicleMappingMethod
  created_at: Generated<Date>
  updated_at: Generated<Date>
}
```

Extend `Database` with all four members.

- [ ] **Step 4: Add migration `0005_create_vehicle_source_tables.ts`**

Create PostgreSQL 18 tables with `uuidv7()` IDs and exact constraints:

```sql
create table vehicle_source_providers (
  id uuid primary key default uuidv7(),
  code text not null unique,
  source_name text not null,
  source_url text null,
  license text null,
  created_at timestamptz not null default now()
);

create table vehicle_source_imports (
  id uuid primary key default uuidv7(),
  provider_id uuid not null references vehicle_source_providers(id),
  version text not null,
  checksum_sha256 text not null,
  imported_at timestamptz not null default now(),
  unique(provider_id, version, checksum_sha256)
);

create table vehicle_source_records (
  id uuid primary key default uuidv7(),
  provider_id uuid not null references vehicle_source_providers(id),
  source_key text not null,
  brand_raw text not null,
  type_raw text not null,
  available_model_years integer[] not null,
  active boolean not null default true,
  mapping_needs_review boolean not null default false,
  first_seen_import_id uuid not null references vehicle_source_imports(id),
  last_seen_import_id uuid not null references vehicle_source_imports(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, source_key)
);

create table vehicle_source_mappings (
  source_record_id uuid primary key references vehicle_source_records(id),
  vehicle_model_id uuid not null references vehicle_models(id),
  mapping_method text not null check (mapping_method in ('manual','exact-rule','curated-import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index vehicle_source_records_provider_active_idx
  on vehicle_source_records(provider_id, active);
create index vehicle_source_records_provider_review_idx
  on vehicle_source_records(provider_id, mapping_needs_review);
create index vehicle_source_imports_provider_imported_idx
  on vehicle_source_imports(provider_id, imported_at desc);
create index vehicle_source_mappings_model_idx
  on vehicle_source_mappings(vehicle_model_id);
```

`down()` drops child-to-parent: mappings -> records -> imports -> providers.

- [ ] **Step 5: Run targeted + full integration tests**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source.integration.test.ts
pnpm --filter @bizzat/api test:integration
```

Expected: PASS; existing identity/location/Phase A vehicle tests remain green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/client.ts \
  apps/api/src/db/domain-migrations/0005_create_vehicle_source_tables.ts \
  apps/api/test/vehicle-source.integration.test.ts
git commit -m "feat: add vehicle source provenance schema"
```

---

### Task 2: TSB snapshot normalization, validation, checksum, and import lifecycle

**Files:**
- Create: `apps/api/src/reference/vehicle/source/source.types.ts`
- Create: `apps/api/src/reference/vehicle/source/source-normalization.ts`
- Create: `apps/api/src/reference/vehicle/source/source-validator.ts`
- Create: `apps/api/src/reference/vehicle/source/source-checksum.ts`
- Create: `apps/api/src/reference/vehicle/source/source-importer.ts`
- Create/Test: `apps/api/test/vehicle-source-validator.test.ts`
- Modify/Test: `apps/api/test/vehicle-source.integration.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

```ts
export interface NormalizedVehicleSourceSnapshot {
  provider: {
    code: 'tsb-kasko'
    sourceName: string
    sourceUrl?: string
    version: string
  }
  records: Array<{
    sourceKey: string
    brandRaw: string
    typeRaw: string
    availableModelYears: number[]
  }>
}

export class VehicleSourceValidationError extends Error {
  readonly code = 'VEHICLE_SOURCE_INVALID'
}

export function validateAndNormalizeVehicleSourceSnapshot(
  value: unknown,
  now = new Date(),
): NormalizedVehicleSourceSnapshot

export function normalizeVehicleSourceIdentity(value: string): string

export function checksumVehicleSourceSnapshot(
  snapshot: NormalizedVehicleSourceSnapshot,
): string

export interface VehicleSourceImportResult {
  providerId: string
  importId: string
  checksum: string
  counts: {
    inserted: number
    updated: number
    reactivated: number
    deactivated: number
    reviewRequiredSet: number
  }
}

export function importVehicleSourceSnapshot(
  db: Kysely<Database>,
  snapshot: NormalizedVehicleSourceSnapshot,
): Promise<VehicleSourceImportResult>
```

- [ ] **Step 1: Write validator/normalization/checksum tests first**

Cover exact behaviors:

```text
valid unknown input narrows to normalized snapshot
provider.code other than tsb-kasko rejected
empty records rejected
blank sourceKey/brandRaw/typeRaw rejected
duplicate sourceKey rejected
availableModelYears empty rejected
non-integer/out-of-range year rejected
years sort + deduplicate
case/whitespace-only identity normalization compares equal
meaningful type token change compares different
checksum equal despite record order/year order differences
malformed object/array shapes rejected with VehicleSourceValidationError
```

Use a fixed `now = new Date('2026-09-08T00:00:00Z')`; valid year range is `1886..2027` in these tests.

- [ ] **Step 2: Run unit tests and confirm RED**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source-validator.test.ts
```

Expected: FAIL because B1 normalization/validation/checksum modules do not exist.

- [ ] **Step 3: Implement runtime normalization and validation**

`validateAndNormalizeVehicleSourceSnapshot` accepts `unknown`; no `as NormalizedVehicleSourceSnapshot` shortcut.

String comparison normalization is deterministic:

```ts
value
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .replace(/\s*([/,-])\s*/g, '$1')
  .toLocaleUpperCase('tr-TR')
```

Do not remove numeric, engine, trim, transmission, body, or power tokens.

Return display/raw fields trimmed/NFKC/collapsed-whitespace but preserve their meaningful case/content; use `normalizeVehicleSourceIdentity` only for comparisons/checksum identity canonicalization.

Normalize years via sorted unique integers after validating every input year. Upper bound is `now.getUTCFullYear() + 1`.

- [ ] **Step 4: Implement deterministic checksum**

Build a fixed-key-order logical object containing trimmed provider fields and records sorted by `sourceKey`; each record uses normalized comparison brand/type and sorted years. SHA-256 UTF-8 compact JSON with `node:crypto`.

The same logical snapshot with different record/year order must have identical checksum.

- [ ] **Step 5: Run validator/checksum tests and confirm GREEN**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source-validator.test.ts
```

Expected: all B1 unit tests PASS.

- [ ] **Step 6: Add failing source-import lifecycle integration tests**

Create a unique snapshot with at least three invented records:

```text
144-1064 / TOYOTA / COROLLA 1.33 LIFE / [2016,2017,2018]
122-1260 / RENAULT (OYAK) / CLIO EVOLUTION 1.0 TCE X-TRONIC 90 / [2022,2023,2024]
100-0001 / FIAT / EGEA SEDAN EASY 1.4 FIRE 95 / [2020,2021]
```

Test:

1. first import creates one provider/import and three source records;
2. identical logical import is idempotent and reuses provider/import/source UUIDs;
3. same source code with changed years reuses source UUID and updates years;
4. removing one record marks it inactive;
5. reintroducing it reuses the same UUID;
6. mapping one record, then changing only case/whitespace does **not** set review;
7. changing mapped `typeRaw` meaningfully sets `mapping_needs_review=true`;
8. changing an unmapped record never manufactures a mapping;
9. an invalid/empty snapshot is rejected before working DB state changes.

- [ ] **Step 7: Implement transactional source importer**

Before transaction: assume caller supplied normalized snapshot from validator; compute checksum.

Inside one transaction:

```text
upsert provider by code
insert/find import by provider + version + checksum
for each source record:
  read previous source row by provider + sourceKey
  detect previous active state
  if previous exists and mapping exists, compare normalized previous/new brand+type
  insert or update source row
  preserve first_seen_import_id
  set last_seen_import_id=current import
  set active=true
  set mapping_needs_review=true only when mapped identity changed materially
mark provider source rows absent from current NON-EMPTY key set active=false
return deterministic counts
```

Importer never clears a true review flag and never mutates `vehicle_source_mappings`.

For first insert, `first_seen_import_id` and `last_seen_import_id` are the same current import ID.

- [ ] **Step 8: Run targeted + full tests**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source-validator.test.ts
pnpm --filter @bizzat/api exec vitest run test/vehicle-source.integration.test.ts
pnpm --filter @bizzat/api test:integration
```

Expected: all PASS.

- [ ] **Step 9: Add validator to package unit-test script**

Update `apps/api/package.json` so `test` includes `test/vehicle-source-validator.test.ts` alongside existing unit tests.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/reference/vehicle/source \
  apps/api/test/vehicle-source-validator.test.ts \
  apps/api/test/vehicle-source.integration.test.ts \
  apps/api/package.json
git commit -m "feat: import normalized TSB vehicle sources"
```

---

### Task 3: Reviewed mapping apply and deterministic coverage report

**Files:**
- Create: `apps/api/src/reference/vehicle/source/mapping.types.ts`
- Create: `apps/api/src/reference/vehicle/source/mapping-validator.ts`
- Create: `apps/api/src/reference/vehicle/source/mapping-service.ts`
- Create: `apps/api/src/reference/vehicle/source/source-report.ts`
- Modify/Test: `apps/api/test/vehicle-source-validator.test.ts`
- Modify/Test: `apps/api/test/vehicle-source.integration.test.ts`

**Interfaces:**

```ts
export interface VehicleSourceMappingFile {
  version: string
  mappings: Array<{
    sourceKey: string
    vehicleModelKey: string
    method: VehicleMappingMethod
  }>
}

export function validateVehicleSourceMappingFile(value: unknown): VehicleSourceMappingFile

export interface VehicleSourceMappingApplyResult {
  applied: number
}

export function applyVehicleSourceMappings(
  db: Kysely<Database>,
  providerCode: 'tsb-kasko',
  file: VehicleSourceMappingFile,
): Promise<VehicleSourceMappingApplyResult>

export interface VehicleSourceCoverageReport {
  provider: string
  activeRecords: number
  trustedMapped: number
  unmapped: number
  reviewRequired: number
  invalidMappings: number
  inactiveRecords: number
  details: Array<{
    sourceKey: string
    brandRaw: string
    typeRaw: string
    status: 'trusted-mapped' | 'unmapped' | 'review-required' | 'invalid-mapping' | 'inactive'
    vehicleModelKey: string | null
  }>
}

export function buildVehicleSourceCoverageReport(
  db: Kysely<Database>,
  providerCode: 'tsb-kasko',
): Promise<VehicleSourceCoverageReport>
```

- [ ] **Step 1: Add mapping-file validator tests**

Cover:

```text
blank version rejected
mappings must be array
duplicate sourceKey rejected
blank sourceKey/modelKey rejected
unknown mapping method rejected
valid methods manual/exact-rule/curated-import accepted
malformed unknown input rejected
```

Use the same `VehicleSourceValidationError` or define `VehicleSourceMappingValidationError` with code `VEHICLE_SOURCE_MAPPING_INVALID`; prefer the separate mapping error class so failures are clear in maintenance logs.

- [ ] **Step 2: Run mapping validator tests and confirm RED**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source-validator.test.ts
```

Expected: FAIL until mapping validator is implemented.

- [ ] **Step 3: Implement mapping validation**

Normalize only surrounding whitespace. Do not auto-rewrite source codes or canonical catalog keys. Validate method against the three allowed literals.

- [ ] **Step 4: Add failing mapping/apply/report integration tests**

Start from:

1. Phase A canonical vehicle fixture imported into DB;
2. a B1 TSB source fixture imported into DB.

Test mapping apply:

```text
sourceKey resolves only under provider tsb-kasko
vehicleModelKey resolves by vehicle_models.catalog_key
missing source => reject + rollback
missing canonical target => reject + rollback
inactive canonical target => reject + rollback
valid apply upserts mapping + method and clears mapping_needs_review
file omission does not delete an unrelated existing mapping
re-apply is idempotent
```

Test report states by constructing records for:

```text
trusted mapped
unmapped
review required
invalid mapping (canonical model later marked inactive)
inactive source
```

Assert summary counts and deterministic detail order by normalized brand/type/source key.

- [ ] **Step 5: Implement transactional mapping apply**

One transaction:

```text
resolve provider by code
for each file mapping:
  resolve source record by provider + sourceKey
  resolve active canonical model by catalog_key
  upsert vehicle_source_mappings(source_record_id)
  set mapping_method + updated_at
  clear source mapping_needs_review=false
commit
```

Do not delete mappings absent from the file. Do not reactivate inactive source records as a side effect of mapping apply.

- [ ] **Step 6: Implement deterministic coverage report**

Query provider source rows left-joined to mappings + canonical models. Classify exactly:

```text
!source.active => inactive
source.active && no mapping => unmapped
source.active && mapping_needs_review => review-required
source.active && mapping && !model.active => invalid-mapping
source.active && mapping && !mapping_needs_review && model.active => trusted-mapped
```

Precedence matters: inactive source is `inactive` even if it still retains a mapping row.

`activeRecords` counts all active source rows. `inactiveRecords` counts inactive source rows.

Sort details by `normalizeVehicleSourceIdentity(brandRaw)`, then normalized `typeRaw`, then `sourceKey`.

- [ ] **Step 7: Run targeted + full tests**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-source-validator.test.ts
pnpm --filter @bizzat/api exec vitest run test/vehicle-source.integration.test.ts
pnpm test
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/reference/vehicle/source \
  apps/api/test/vehicle-source-validator.test.ts \
  apps/api/test/vehicle-source.integration.test.ts
git commit -m "feat: apply and report vehicle source mappings"
```

---

### Task 4: Explicit B1 CLI commands, deterministic fixtures, and CI gates

**Files:**
- Create: `apps/api/src/reference/vehicle/source/source-import-cli.ts`
- Create: `apps/api/src/reference/vehicle/source/mapping-apply-cli.ts`
- Create: `apps/api/src/reference/vehicle/source/source-report-cli.ts`
- Create: `data/reference/vehicles/fixture.tsb-source.json`
- Create: `data/reference/vehicles/fixture.tsb-mappings.json`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

Package commands:

```text
reference:import:vehicle-source
reference:apply:vehicle-mappings
reference:report:vehicle-source
```

Root commands:

```text
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
```

- [ ] **Step 1: Add invented normalized source fixture**

`fixture.tsb-source.json`:

```json
{
  "provider": {
    "code": "tsb-kasko",
    "sourceName": "Türkiye Sigorta Birliği Kasko Değer Listesi - CI fixture",
    "sourceUrl": "https://www.tsb.org.tr/tr/kasko-arsiv-listesi",
    "version": "fixture-2026-09"
  },
  "records": [
    {
      "sourceKey": "144-1064",
      "brandRaw": "TOYOTA",
      "typeRaw": "COROLLA 1.33 LIFE",
      "availableModelYears": [2016, 2017, 2018]
    },
    {
      "sourceKey": "122-1260",
      "brandRaw": "RENAULT (OYAK)",
      "typeRaw": "CLIO EVOLUTION 1.0 TCE X-TRONIC 90",
      "availableModelYears": [2022, 2023, 2024]
    },
    {
      "sourceKey": "100-0001",
      "brandRaw": "FIAT",
      "typeRaw": "EGEA SEDAN EASY 1.4 FIRE 95",
      "availableModelYears": [2020, 2021]
    }
  ]
}
```

This is invented test data, not an extracted/licensed TSB redistribution file.

- [ ] **Step 2: Add mapping fixture**

Map only records that resolve against the existing Phase A fixture:

```json
{
  "version": "fixture-2026-09.1",
  "mappings": [
    {
      "sourceKey": "122-1260",
      "vehicleModelKey": "renault:clio:1-0-tce-evolution",
      "method": "curated-import"
    },
    {
      "sourceKey": "100-0001",
      "vehicleModelKey": "fiat:egea:1-4-fire-easy",
      "method": "curated-import"
    }
  ]
}
```

Toyota intentionally remains unmapped in CI so the report proves the unmapped path.

- [ ] **Step 3: Implement CLI argument parsing using the established invocation-root pattern**

For import/apply commands, parse non-`--` args:

```ts
const args = process.argv.slice(2).filter((arg) => arg !== '--')
```

Require provider alias `tsb`, then file path. Resolve file relative to:

```ts
const invocationRoot = process.env.INIT_CWD ?? process.cwd()
```

Translate alias `tsb` -> provider code `tsb-kasko`; reject any other provider alias in B1.

Parse JSON as `unknown`; call runtime validators before DB operations. Always `db.destroy()` in `finally`.

Report CLI requires only provider alias and prints compact JSON report.

- [ ] **Step 4: Add package/root scripts**

In `apps/api/package.json`:

```json
"reference:import:vehicle-source": "tsx src/reference/vehicle/source/source-import-cli.ts",
"reference:apply:vehicle-mappings": "tsx src/reference/vehicle/source/mapping-apply-cli.ts",
"reference:report:vehicle-source": "tsx src/reference/vehicle/source/source-report-cli.ts"
```

In root `package.json` reuse `scripts/run-pnpm.mjs` for all three commands; do not add another env runner.

- [ ] **Step 5: Add CI B1 gate after canonical vehicle fixture import**

Existing order must remain:

```text
migrations
location fixture import
canonical vehicle fixture import
TSB source fixture import
TSB mapping fixture apply
TSB source report
full tests
build
```

Add exact steps:

```yaml
- name: Import deterministic TSB source fixture
  run: pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json

- name: Apply deterministic TSB mapping fixture
  run: pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json

- name: Report deterministic TSB source coverage
  run: pnpm reference:report:vehicle-source -- tsb
```

Expected report summary after fixtures:

```json
{
  "provider":"tsb-kasko",
  "activeRecords":3,
  "trustedMapped":2,
  "unmapped":1,
  "reviewRequired":0,
  "invalidMappings":0,
  "inactiveRecords":0
}
```

The report may also contain `details`; CI success must not depend on whitespace/property formatting beyond process exit 0. Integration tests enforce exact counts.

- [ ] **Step 6: Run exact root maintenance flow**

With PostgreSQL up and migrations applied:

```bash
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
```

Expected: all exit 0; report shows 3 active / 2 trusted / 1 unmapped.

- [ ] **Step 7: Run full verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/reference/vehicle/source \
  data/reference/vehicles/fixture.tsb-source.json \
  data/reference/vehicles/fixture.tsb-mappings.json \
  apps/api/package.json package.json .github/workflows/ci.yml
git commit -m "chore: add vehicle source maintenance commands"
```

---

### Task 5: Documentation, scope review, and B1 merge gate

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Verify: `.github/workflows/ci.yml`
- Verify: complete `main...HEAD` diff against B1 spec.

**Interfaces:**
- Documents B1 source acquisition boundary, commands, reporting states, and the fact that B2 real Turkey catalog curation remains next.

- [ ] **Step 1: Update README**

Document:

```text
B1 source ingestion is maintenance-only.
Raw TSB exports are not committed.
Kasko prices are not stored.
TSB source identity is vehicle code only; years are metadata.
Commands:
  pnpm reference:import:vehicle-source -- tsb <normalized-json>
  pnpm reference:apply:vehicle-mappings -- tsb <mapping-json>
  pnpm reference:report:vehicle-source -- tsb
Runtime public vehicle endpoints still read canonical PostgreSQL tables only.
The committed TSB source/mapping files are invented CI fixtures, not the real TSB dataset.
B2 real Turkey catalog curation/population is still pending.
```

- [ ] **Step 2: Update AGENTS guardrails**

Add exact rules:

```text
TSB source_key is Araç Kodu only; never append model year
TSB years are source metadata, never listing validity
never persist kasko prices unless a separately approved product feature needs them
raw TSB exports must not enter the public repo
source import cannot mutate canonical vehicle taxonomy
source import cannot clear mapping_needs_review
mapping apply cannot target inactive canonical models
mapping file omission never deletes unrelated mappings
runtime/public API never joins or fetches TSB source data for picker options
```

- [ ] **Step 3: Fresh final verification**

Run/require the exact permanent CI gate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bizzat/api db:migrate:raw
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

Expected: every command exits 0. Record final unit/integration/web test counts before completion claim.

- [ ] **Step 4: Whole-branch B1 scope review**

`main...HEAD` must contain:

```text
YES: four vehicle_source_* tables
YES: TSB normalized runtime validator/checksum/importer
YES: mapping apply + stale review flag behavior
YES: deterministic report
YES: invented small fixtures + CLI + CI + docs
NO: raw TSB spreadsheet/export
NO: kasko values/prices
NO: brand/series alias/candidate generator
NO: real Turkey catalog.json population
NO: source code + model year identity
NO: runtime external fetch
NO: LLM/fuzzy mapping
NO: Redis/search/queue/worker/microservice
```

Remove any scope leak before PR approval.

- [ ] **Step 5: Commit docs/final changes**

```bash
git add README.md AGENTS.md .github/workflows/ci.yml
git commit -m "docs: document TSB source ingestion boundary"
```

- [ ] **Step 6: PR and merge criteria**

Open/ready the B1 PR only after branch checks pass. Merge only after PR-triggered permanent CI passes with frozen lockfile, explicit migrations, location/canonical/source imports, mapping apply, coverage report, all tests, build, and Next standalone verification.

After merge, B2 starts from fresh `main` with its own plan for aliases, deterministic candidates, reviewed mappings, provenance, and the real Turkey canonical automobile catalog.
