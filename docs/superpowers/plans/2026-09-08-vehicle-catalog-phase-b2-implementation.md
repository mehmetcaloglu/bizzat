# Vehicle Catalog Phase B2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate Bizzat's canonical automobile `brand -> series -> model` catalog for the Turkish market using deterministic alias/candidate tooling, a maintenance-only normalized TSB source snapshot, reviewed repository data, and measurable mapping coverage.

**Architecture:** Runtime remains unchanged: public vehicle pickers read only `vehicle_brands`, `vehicle_series`, and `vehicle_models` from PostgreSQL. B2 operates entirely as maintenance/curation: a temporary acquisition workflow obtains a normalized, price-free TSB snapshot from the official public TSB web endpoints; repository-owned aliases deterministically classify exact brand/series candidates; reviewed generated `catalog.json` and `tsb-mappings.json` are then imported by the existing Phase A/B1 commands. Raw TSB workbooks, kasko prices, and acquisition artifacts never become repository data.

**Tech Stack:** Node.js 24 LTS, TypeScript 6, PostgreSQL 18, Kysely, Vitest, pnpm workspace; temporary GitHub Actions acquisition uses Python 3 + `requests` + `openpyxl` and is deleted before merge.

**Spec:** `docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md`

## Global Constraints

- Canonical IDs remain Bizzat UUIDs and stable `catalog_key` values; TSB vehicle codes never become listing identity.
- `model_year` stays a listing field; it is not a canonical hierarchy level or validity gate.
- B2 does not add generations, engines, trim tables, spec sheets, VIN decoding, Redis, search, queues, workers, microservices, or runtime LLM calls.
- TSB is maintenance-only. Runtime, API startup, migrations, and deploy perform zero TSB HTTP calls.
- Raw TSB XLS/XLSX/CSV files and kasko prices are never committed.
- The normalized TSB operational snapshot contains only `sourceKey`, `brandRaw`, `typeRaw`, and `availableModelYears` plus provider/version provenance.
- `data/reference/vehicles/catalog.json`, alias files, mapping files, and source manifest are repository-owned review artifacts.
- Ambiguous brand/series candidates remain unmapped. No fuzzy match is used to force coverage.
- Exact-rule generation is allowed only when both brand and series resolution are deterministic under reviewed alias files.
- Generated catalog/mapping files must pass the existing Phase A canonical validator/importer and B1 mapping validator/apply path.
- The temporary TSB acquisition workflow/script is execution infrastructure only and must be removed before the final PR merge.
- Open nameplate bootstrap source is `serhatkildaci/global-car-models` pinned to commit `44da5c9e5e0f3162d65579033f7a641473308b11` under its MIT license.
- The official TSB maintenance source is `https://www.tsb.org.tr/tr/kasko-arsiv-listesi`; TSB states the Kasko list covers up to 15 model years.

---

## File Map

### Permanent B2 curation code

- `apps/api/src/reference/vehicle/curation/alias.types.ts`: repository alias DTOs.
- `apps/api/src/reference/vehicle/curation/alias-validator.ts`: runtime validation for brand/series aliases.
- `apps/api/src/reference/vehicle/curation/candidate-generator.ts`: deterministic brand + longest token-boundary series resolution and proposed model labels.
- `apps/api/src/reference/vehicle/curation/generate-catalog-cli.ts`: reads normalized TSB snapshot + reviewed aliases + bootstrap nameplates and emits reviewable canonical catalog/mapping outputs.
- `apps/api/test/vehicle-curation.test.ts`: alias and candidate unit tests.

### Permanent B2 repository data

- `data/reference/vehicles/brand-aliases.json`: reviewed TSB brand text -> Bizzat canonical brand key.
- `data/reference/vehicles/series-aliases.json`: reviewed per-brand series aliases.
- `data/reference/vehicles/catalog.json`: operational canonical automobile taxonomy.
- `data/reference/vehicles/tsb-mappings.json`: reviewed/derived TSB code -> canonical model key mappings.
- `data/reference/vehicles/source-manifest.json`: provenance and license/terms notes.

### Temporary acquisition only; remove before merge

- `.github/workflows/vehicle-b2-acquire.yml`: feature-branch-only workflow that downloads the current official TSB monthly archive and emits a normalized JSON artifact without prices/raw workbook retention.
- `scripts/maintenance/acquire-tsb-source.py`: temporary parser/fetcher used only by that workflow.

### Existing files updated

- `apps/api/package.json`: B2 candidate/catalog generation script.
- `package.json`: root B2 maintenance command.
- `.github/workflows/ci.yml`: validate/import permanent catalog + mappings and run deterministic curation tests; no remote TSB fetch.
- `README.md`
- `AGENTS.md`

---

## Task 1: Alias contracts and deterministic candidate engine

**Files:**
- Create: `apps/api/src/reference/vehicle/curation/alias.types.ts`
- Create: `apps/api/src/reference/vehicle/curation/alias-validator.ts`
- Create: `apps/api/src/reference/vehicle/curation/candidate-generator.ts`
- Create/Test: `apps/api/test/vehicle-curation.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

```ts
export interface VehicleBrandAliasesFile {
  version: string
  aliases: Array<{ raw: string; brandKey: string }>
}

export interface VehicleSeriesAliasesFile {
  version: string
  entries: Array<{
    brandKey: string
    seriesKey: string
    aliases: string[]
  }>
}

export interface VehicleCurationCandidate {
  sourceKey: string
  brandRaw: string
  typeRaw: string
  brandKeyCandidate: string | null
  seriesKeyCandidate: string | null
  proposedModelLabel: string | null
  status: 'exact-series' | 'ambiguous-series' | 'unknown-brand' | 'no-series'
}

export function validateVehicleBrandAliases(value: unknown): VehicleBrandAliasesFile
export function validateVehicleSeriesAliases(value: unknown): VehicleSeriesAliasesFile

export function generateVehicleCurationCandidates(args: {
  records: NormalizedVehicleSourceSnapshot['records']
  brandAliases: VehicleBrandAliasesFile
  seriesAliases: VehicleSeriesAliasesFile
}): VehicleCurationCandidate[]
```

- [ ] **Step 1: Write RED tests for alias validation and candidate resolution**

Cover malformed/blank/duplicate aliases, longest token-boundary series preference, equal-specificity ambiguity, unknown brand, no-series, and exact-series proposed labels.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-curation.test.ts
```

- [ ] **Step 3: Implement minimal validators + deterministic matcher**

Resolve brand only through explicit aliases; resolve series only within that brand; choose the longest token-boundary alias; equal top matches to different series => ambiguous; no fuzzy/LLM path.

- [ ] **Step 4: Verify GREEN and register test**

```bash
pnpm --filter @bizzat/api exec vitest run test/vehicle-curation.test.ts
pnpm --filter @bizzat/api test
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/reference/vehicle/curation apps/api/test/vehicle-curation.test.ts apps/api/package.json
git commit -m "feat: add deterministic vehicle curation candidates"
```

---

## Task 2: Acquire a real normalized TSB operational snapshot without committing raw/provider prices

**Temporary files:**
- `scripts/maintenance/acquire-tsb-source.py`
- `.github/workflows/vehicle-b2-acquire.yml`

**Official endpoints used only by temporary maintenance:**

```text
GET https://www.tsb.org.tr/InsuranceData/GetMonthList
GET https://www.tsb.org.tr/InsuranceData/GetInsuranceDataArchiveFile?Year=2026&MonthId=<resolved September id>
GET <returned official archive workbook URL>
```

Resolve month by `MonthOrder == 9`; never assume month database ID equals calendar month.

Parser scans first 25 rows for brand/model codes, model year, brand, model/type, and kasko amount headers. It uses the amount column only to identify valid data rows; it never emits price. Group rows by `<brandCode>-<modelCode>`, fail on conflicting brand/type identity, sort/deduplicate years, and emit the existing B1 normalized JSON contract.

The workflow validates the artifact through the real B1 import/report commands against PostgreSQL, uploads only `tsb.normalized.json` as `vehicle-b2-tsb-normalized`, and deletes the workbook before artifact upload.

---

## Task 3: Build reviewed aliases and generate the initial Turkish canonical catalog + TSB mappings

**Permanent data:**
- `data/reference/vehicles/brand-aliases.json`
- `data/reference/vehicles/series-aliases.json`
- `data/reference/vehicles/catalog.json`
- `data/reference/vehicles/tsb-mappings.json`
- `data/reference/vehicles/source-manifest.json`

**Generator:** `apps/api/src/reference/vehicle/curation/generate-catalog-cli.ts`

Use pinned MIT `global-car-models` `data/models.json` as nameplate bootstrap and the real normalized TSB artifact as Turkey coverage input. Every exact reviewed brand+series candidate may generate a canonical model and an `exact-rule` mapping. Unknown/ambiguous/no-series rows remain unmapped.

Generated output always goes to `/tmp` first:

```text
catalog.generated.json
tsb-mappings.generated.json
candidates.json
summary.json
```

Only collision-free exact-series outputs are copied into repository files after review. Multiple TSB codes producing the same normalized label under one series may share one canonical model; materially different labels colliding on one generated key are blocked.

`source-manifest.json` records TSB period `2026-09`, accessed `2026-09-08`, no open redistribution license observed/raw export not committed/prices discarded; and the exact global-car-models commit + MIT license.

---

## Task 4: Permanent coverage gates and public API verification

Create `apps/api/test/vehicle-catalog-population.integration.test.ts` to import repository `catalog.json` and assert it is materially larger than the Phase A fixture, hierarchy is valid, public vehicle endpoints return populated canonical data, and source metadata never leaks.

Permanent CI remains offline from TSB. It validates alias/catalog/mapping shapes, imports `catalog.json`, still runs the invented B1 source/mapping/report fixture flow, then full lint/typecheck/test/build.

Using the operational normalized snapshot locally/temporarily, measure `activeRecords`, `trustedMapped`, `unmapped`, `reviewRequired`, and `invalidMappings`. Only summary counts may be documented; source detail rows are not committed.

---

## Task 5: Remove temporary acquisition infrastructure, docs, final review, and merge

Delete `.github/workflows/vehicle-b2-acquire.yml` and `scripts/maintenance/acquire-tsb-source.py` before final merge. Update README/AGENTS with canonical catalog, alias, no-raw-TSB/no-price, ambiguity, stable-key, and offline-CI guardrails.

Final whole-diff must contain the curation engine + aliases + populated `catalog.json` + reviewed `tsb-mappings.json` + source manifest + tests/docs, and must NOT contain raw TSB workbook, operational normalized snapshot, prices, runtime TSB fetch, fuzzy/LLM mapping, model-year validity gates, or extra vehicle-spec infrastructure.

Final PR merge gate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bizzat/api db:migrate:raw
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/catalog.json
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

After B2 merge, move to the actual automobile listing domain (`listings` + `car_details` + listing creation flow) rather than continuing to expand catalog infrastructure unless a measured catalog gap blocks MVP.