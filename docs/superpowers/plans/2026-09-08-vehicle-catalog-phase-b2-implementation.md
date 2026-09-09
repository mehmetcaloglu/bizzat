# Vehicle Catalog Phase B2 Implementation Plan

> **Status:** Implemented on `feat/vehicle-catalog-phase-b2`; final CI/review is the merge gate.

**Goal:** Populate Bizzat's canonical automobile `brand -> series -> model` catalog for the Turkish market using deterministic alias/candidate tooling, a maintenance-only normalized TSB source snapshot, reviewed repository data, and measurable mapping coverage.

**Architecture:** Runtime remains unchanged: public vehicle pickers read only `vehicle_brands`, `vehicle_series`, and `vehicle_models` from PostgreSQL. B2 is maintenance/curation only. Temporary acquisition obtained a normalized, price-free TSB snapshot from the official TSB archive; repository-owned aliases classify exact brand/series candidates; a deterministic generator emits review artifacts; reviewed `catalog.json` and `tsb-mappings.json` use the existing Phase A/B1 import/apply paths. Raw TSB workbooks, operational normalized snapshots, kasko prices, and acquisition infrastructure are not repository data.

**Tech Stack:** Node.js 24 LTS, TypeScript 6, PostgreSQL 18, Kysely, Vitest, pnpm workspace. Temporary acquisition used Python 3 + `requests` + `openpyxl` only on the feature branch and was removed before merge.

**Spec:** `docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md`

## Global Constraints

- Canonical IDs remain Bizzat UUIDs and stable `catalog_key` values; TSB vehicle codes never become listing identity.
- `model_year` stays a listing field; it is not a canonical hierarchy level or validity gate.
- B2 does not add generations, engines, trim tables, spec sheets, VIN decoding, Redis, search, queues, workers, microservices, or runtime LLM calls.
- TSB is maintenance-only. Runtime, API startup, migrations, deploy and permanent CI perform zero TSB HTTP calls.
- Raw TSB XLS/XLSX/CSV files, operational normalized snapshots and kasko prices are never committed.
- `data/reference/vehicles/catalog.json`, alias files, mapping files and source manifest are repository-owned review artifacts.
- Ambiguous brand/series candidates remain unmapped. No fuzzy or LLM matching is used to force coverage.
- Exact-rule generation is allowed only when both brand and series resolution are deterministic under reviewed alias files.
- Generated catalog/mapping files pass the existing Phase A canonical validator/importer and B1 mapping validator/apply path.
- Open nameplate bootstrap source is `serhatkildaci/global-car-models` pinned to commit `44da5c9e5e0f3162d65579033f7a641473308b11` under its MIT license.
- Official TSB maintenance source is `https://www.tsb.org.tr/tr/kasko-arsiv-listesi`.

---

## File Map

### Permanent B2 curation code

- `apps/api/src/reference/vehicle/curation/alias.types.ts`: repository alias DTOs.
- `apps/api/src/reference/vehicle/curation/alias-validator.ts`: runtime validation for brand/series aliases.
- `apps/api/src/reference/vehicle/curation/candidate-generator.ts`: deterministic brand + longest token-boundary series resolution and proposed model labels.
- `apps/api/src/reference/vehicle/curation/catalog-generator.ts`: deterministic canonical catalog/mapping generation, stable sorting and collision fail-closed behavior.
- `apps/api/src/reference/vehicle/curation/generate-catalog-cli.ts`: offline maintenance CLI that reads normalized source + reviewed aliases + bootstrap nameplates and emits review artifacts.
- `apps/api/test/vehicle-curation.test.ts`: alias, candidate and catalog-generator tests.
- `apps/api/test/vehicle-curation-data.test.ts`: committed artifact/provenance validation.
- `apps/api/test/vehicle-catalog-population.integration.test.ts`: real catalog PostgreSQL/API integration verification.

### Permanent B2 repository data

- `data/reference/vehicles/brand-aliases.json`: reviewed TSB brand text -> Bizzat canonical brand key.
- `data/reference/vehicles/series-aliases.json`: reviewed per-brand series aliases.
- `data/reference/vehicles/catalog.json`: operational canonical automobile taxonomy.
- `data/reference/vehicles/tsb-mappings.json`: reviewed/derived TSB code -> canonical model key mappings.
- `data/reference/vehicles/source-manifest.json`: provenance, source period, counts and license/terms notes.
- `data/reference/vehicles/fixture.bootstrap-models.json`: tiny deterministic CI fixture for generator plumbing only.

### Temporary acquisition infrastructure — removed before merge

- `.github/workflows/vehicle-b2-acquire.yml`
- `scripts/maintenance/acquire-tsb-source.py`

### Existing files updated

- `apps/api/package.json`: B2 generator command.
- `package.json`: root B2 maintenance command.
- `.github/workflows/ci.yml`: offline generator fixture + real `catalog.json` import + full verification.
- `README.md`
- `AGENTS.md`

---

## Task 1: Alias contracts and deterministic candidate engine

- [x] Runtime validators accept `unknown` and reject malformed/blank/duplicate aliases.
- [x] Brand resolution uses explicit reviewed aliases only.
- [x] Series resolution is within the resolved brand and uses token boundaries.
- [x] Longest alias wins; equal-specificity matches to different series fail closed as `ambiguous-series`.
- [x] Unknown-brand and no-series candidates remain unmapped.
- [x] Unit tests cover these rules.

---

## Task 2: Acquire a real normalized TSB operational snapshot without committing raw/provider prices

Temporary maintenance queried the official TSB archive. The initially requested `2026-09` archive was not yet published, so the acquisition flow was corrected to search backward for the latest published archive instead of treating that as a parser failure. The reviewed B2 curation therefore used **TSB period `2026-08`**, accessed `2026-09-08`.

The real workbook stores model years as separate columns rather than one `Model Yılı` field. The temporary parser was corrected to add a year to `availableModelYears` when that year's matrix cell contains a value. The cell's kasko amount itself was discarded and never emitted.

- [x] Normalize to B1's `sourceKey`, `brandRaw`, `typeRaw`, `availableModelYears` contract.
- [x] Validate the normalized artifact through real B1 import/report commands against PostgreSQL.
- [x] Assert no price field in the normalized artifact.
- [x] Keep workbook out of artifacts/repository.
- [x] Remove temporary acquisition workflow/script before final merge.

---

## Task 3: Build reviewed aliases and generate the initial Turkish canonical catalog + TSB mappings

Permanent generator command:

```bash
pnpm reference:generate:vehicle-catalog -- \
  <normalized-tsb.json> \
  data/reference/vehicles/brand-aliases.json \
  data/reference/vehicles/series-aliases.json \
  <global-car-models/models.json> \
  /tmp/bizzat-vehicle-curation \
  <version>
```

Generated review outputs:

```text
catalog.generated.json
tsb-mappings.generated.json
candidates.json
summary.json
```

Rules:

- [x] Only exact reviewed brand+series candidates may create a model/mapping.
- [x] Multiple TSB codes with the same normalized label under one series may share a canonical model.
- [x] Materially different labels colliding on one generated key exclude the whole collision group.
- [x] Generated output is deterministic and sorted.
- [x] Generator writes review artifacts only; it does not mutate PostgreSQL or fetch providers.
- [x] `source-manifest.json` records real TSB period `2026-08`, access date, no-open-redistribution observation/raw-not-committed/price-discarded note, and exact global-car-models commit + MIT license.

Reviewed initial result recorded in the manifest:

```text
Historical pre-consolidation proposal (superseded by 2026-09-09-vehicle-picker-parity.md):
TSB snapshot records: 27,906
Mapped source codes: 6,685
Canonical brands: 27
Canonical series: 245
Canonical models: 6,652
Slug-collision source records excluded: 11
Ambiguous-series candidates excluded: 1
```

---

## Task 4: Permanent coverage gates and public API verification

- [x] `vehicle-catalog-population.integration.test.ts` imports repository `catalog.json` into real PostgreSQL.
- [x] It verifies the catalog is materially larger than the Phase A fixture and hierarchy keys are unique/valid.
- [x] It verifies public vehicle endpoints serve populated canonical data without source metadata.
- [x] Committed alias/catalog/mapping files pass runtime validation offline.
- [x] Manifest counts are checked against committed catalog/mapping counts.
- [x] Canonical/mapping artifacts are checked for forbidden provider-only fields/prices.
- [x] Permanent CI runs the deterministic generator using tiny local fixtures and never fetches TSB.
- [x] Permanent CI imports real `data/reference/vehicles/catalog.json`, not the Phase A fixture, before full tests/build.

---

## Task 5: Remove temporary acquisition infrastructure, docs, final review, and merge

- [x] Temporary acquisition workflow/script removed.
- [x] README updated with real operational catalog, B2 provenance/counts, generator workflow and next domain phase.
- [x] AGENTS updated with B2 guardrails and maintenance commands.
- [ ] Fresh final CI on the latest PR head is green.
- [ ] Whole-diff review confirms no raw workbook/snapshot/prices/runtime fetch/fuzzy-LLM/model-year validity/spec-engine scope leaks.
- [ ] PR is marked ready and squash-merged.

Final PR merge gate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bizzat/api db:migrate:raw
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm reference:generate:vehicle-catalog -- \
  data/reference/vehicles/fixture.tsb-source.json \
  data/reference/vehicles/brand-aliases.json \
  data/reference/vehicles/series-aliases.json \
  data/reference/vehicles/fixture.bootstrap-models.json \
  /tmp/bizzat-vehicle-curation-ci \
  ci-fixture
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/catalog.json
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
pnpm test
pnpm build
test -f apps/web/.next/standalone/apps/web/server.js
```

After B2 merge, move to the actual automobile listing domain (`listings` + `car_details` + listing creation flow) rather than continuing to expand catalog infrastructure unless a measured catalog gap blocks MVP.
