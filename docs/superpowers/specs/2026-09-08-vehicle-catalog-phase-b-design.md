# Vehicle Catalog Phase B Design

Date: 2026-09-08
Status: Approved in chat, awaiting written-spec review

## Relationship to the base design

This document is the normative Phase B addendum to:

`docs/superpowers/specs/2026-09-08-vehicle-catalog-design.md`

Phase A remains unchanged: Bizzat owns the canonical `brand -> series -> model` taxonomy and runtime listing/public APIs use Bizzat UUIDs only.

This Phase B design **supersedes one source-identity detail in the base design**:

> For TSB, `source_key` is the TSB vehicle code alone. Model year is metadata and is not part of source identity.

So the old conceptual form:

```text
tsb-kasko:122-1260:2024
```

is replaced by:

```text
source_key = 122-1260
```

A single TSB source record may cover multiple model years.

## Goal

Add a maintenance-only Turkey vehicle coverage and curation layer around the Phase A canonical catalog without making TSB, another provider, or heuristic classification part of the live product runtime.

Phase B must let Bizzat:

1. import normalized TSB vehicle-code facts with provenance;
2. preserve source-record identity across monthly/source updates;
3. detect stale mappings when a TSB code's normalized identity changes;
4. maintain reviewed mappings from TSB codes to Bizzat canonical models;
5. generate deterministic mapped/unmapped/review-required reports;
6. use TSB and curated aliases to help populate a real Turkey automobile catalog;
7. keep all live listing/public reads on PostgreSQL canonical tables only.

## Non-goals

Phase B does not add:

- TSB as a runtime API dependency;
- automatic scheduled scraping or downloading;
- public redistribution of raw TSB exports;
- TSB kasko prices as a Bizzat feature;
- VIN decoding;
- manufacturer spec sheets;
- generation/chassis/engine-code tables;
- a universal trim ontology;
- runtime LLM classification;
- an admin catalog UI;
- Redis, Elasticsearch/OpenSearch, queues, microservices, or scheduled workers.

## Current TSB boundary

The official TSB Kasko Value List is useful as Turkish-market coverage evidence. The official page currently states that the list covers up to 15 model years and exposes an interactive archive/file-generation flow rather than a documented stable public API contract.

The TSB website also does not present an open redistribution license for the raw Kasko dataset. Therefore Bizzat takes the conservative operational approach below.

### Allowed maintenance use

```text
Official TSB file/export
        |
        | local maintenance boundary
        v
normalized source snapshot
        |
        v
PostgreSQL vehicle_source_* tables
```

### Hard rules

- Normal product/runtime requests never fetch TSB.
- API startup never downloads or imports TSB.
- Deploy/migration never downloads TSB.
- Raw TSB spreadsheets/exports are not committed to the public Bizzat repository.
- TSB kasko price values are not stored in the Bizzat source catalog.
- The source layer stores only the minimal vehicle-identification facts required for coverage/mapping.
- A normalized test fixture with invented/example records may live in the repository.
- A production normalized TSB snapshot is operational input, not a repository-owned public redistribution artifact.

This is a data-engineering boundary, not a legal opinion. If TSB later publishes explicit API/licensing terms, the acquisition process can be reconsidered without changing the canonical Bizzat identity model.

## Why TSB vehicle code is the source identity

TSB organizes a vehicle type around an `Araç Kodu` and associates model-year/value information with that type.

Bizzat therefore maps the source **vehicle type**, not each year occurrence.

Conceptually:

```text
TSB code: 144-1064
brand: TOYOTA
type: COROLLA 1.33 LIFE
years: [2013, 2014, 2015, 2016, 2017, 2018]
          |
          v
Toyota / Corolla / 1.33 Life
```

Mapping the same TSB code once is preferable to creating one mapping per model year.

`available_model_years` is descriptive source metadata only. It is never a listing-validity gate because TSB's coverage window is incomplete for older vehicles.

## Phase B decomposition

Phase B is intentionally split into two implementation PRs.

### B1 — TSB source ingestion and mapping infrastructure

B1 implements:

- `vehicle_source_providers`;
- `vehicle_source_imports`;
- `vehicle_source_records`;
- `vehicle_source_mappings`;
- normalized TSB snapshot validation;
- explicit source import CLI;
- explicit mapping import/apply CLI;
- stale-mapping detection;
- deterministic mapped/unmapped/review-required report;
- small deterministic source/mapping fixtures;
- PostgreSQL integration tests;
- CI/docs.

B1 does **not** attempt to build the full Turkey catalog.

### B2 — Turkey catalog curation and population

B2 implements:

- canonical brand normalization rules;
- repository-owned series aliases;
- candidate generator;
- reviewed `tsb-mappings.json`;
- reviewed real Turkey automobile `catalog.json`;
- coverage report;
- canonical import of the populated catalog;
- integration verification against the public Phase A endpoints.

This split keeps source ingestion mechanics separate from the large human-reviewable taxonomy/data change.

---

# B1 design — source ingestion and mapping

## Database model

### `vehicle_source_providers`

Fields:

```text
id           uuid PK default uuidv7()
code         text UNIQUE NOT NULL
source_name  text NOT NULL
source_url   text NULL
license      text NULL
created_at   timestamptz NOT NULL default now()
```

Initial row:

```text
code        = tsb-kasko
source_name = Türkiye Sigorta Birliği Kasko Değer Listesi
source_url  = https://www.tsb.org.tr/tr/kasko-arsiv-listesi
```

`license` is metadata only. Do not invent an open license when none is published.

### `vehicle_source_imports`

Each accepted normalized snapshot has one provenance row.

```text
id               uuid PK default uuidv7()
provider_id      uuid FK -> vehicle_source_providers.id
version          text NOT NULL
checksum_sha256  text NOT NULL
imported_at      timestamptz NOT NULL default now()
```

Unique:

```text
(provider_id, version, checksum_sha256)
```

`version` is an operator-supplied source period/version such as:

```text
2026-09
```

The checksum is computed from the normalized source snapshot, not from a private/raw spreadsheet file.

### `vehicle_source_records`

One active row represents one provider vehicle identity.

```text
id                     uuid PK default uuidv7()
provider_id            uuid FK -> vehicle_source_providers.id
source_key              text NOT NULL
brand_raw               text NOT NULL
type_raw                text NOT NULL
available_model_years   integer[] NOT NULL
active                  boolean NOT NULL default true
mapping_needs_review    boolean NOT NULL default false
first_seen_import_id    uuid FK -> vehicle_source_imports.id
last_seen_import_id     uuid FK -> vehicle_source_imports.id
created_at              timestamptz NOT NULL default now()
updated_at              timestamptz NOT NULL default now()
```

Unique:

```text
(provider_id, source_key)
```

For TSB:

```text
source_key = Araç Kodu
```

Examples:

```text
144-1064
122-1260
```

Do not prefix the stored key with provider code; provider scope is already represented by `provider_id`.

### `available_model_years`

Years are stored as a sorted, unique PostgreSQL integer array.

Example:

```text
[2013, 2014, 2015, 2016, 2017, 2018]
```

Rules:

- duplicate years are rejected by validator or normalized deterministically before DB import;
- stored order is ascending;
- year values do not create canonical catalog rows;
- year values do not create separate source records;
- year values do not restrict `car_details.model_year`.

### `vehicle_source_mappings`

A reviewed mapping links one source vehicle type to one Bizzat canonical model.

```text
source_record_id  uuid PK/FK -> vehicle_source_records.id
vehicle_model_id  uuid FK -> vehicle_models.id
mapping_method    text NOT NULL
created_at        timestamptz NOT NULL default now()
updated_at        timestamptz NOT NULL default now()
```

Allowed initial methods:

```text
manual
exact-rule
curated-import
```

No confidence score is stored initially.

### Indexes

Initial indexes only:

```text
vehicle_source_records(provider_id, active)
vehicle_source_records(provider_id, mapping_needs_review)
vehicle_source_imports(provider_id, imported_at desc)
vehicle_source_mappings(vehicle_model_id)
```

Do not build text-search or fuzzy-match indexes in B1.

## Normalized TSB snapshot contract

B1 starts at a normalized JSON boundary. The production raw TSB export remains outside the repository.

Conceptual normalized shape:

```json
{
  "provider": {
    "code": "tsb-kasko",
    "sourceName": "Türkiye Sigorta Birliği Kasko Değer Listesi",
    "sourceUrl": "https://www.tsb.org.tr/tr/kasko-arsiv-listesi",
    "version": "2026-09"
  },
  "records": [
    {
      "sourceKey": "144-1064",
      "brandRaw": "TOYOTA",
      "typeRaw": "COROLLA 1.33 LIFE",
      "availableModelYears": [2013, 2014, 2015, 2016, 2017, 2018]
    }
  ]
}
```

B1 does not require a public raw-file parser contract. It requires a deterministic normalized snapshot contract that can be populated from an official export during maintenance.

A future raw XLS/XLSX/CSV adapter is permitted only as a thin maintenance adapter that emits this same normalized shape; it must not alter DB/domain contracts.

## Source snapshot validation

Validation is fail-closed and occurs before a DB transaction.

Exact rules:

```text
provider.code == "tsb-kasko" for the TSB adapter
provider.sourceName.trim() non-empty
provider.version.trim() non-empty
records is an array
sourceKey.trim() non-empty
brandRaw.trim() non-empty
typeRaw.trim() non-empty
availableModelYears is a non-empty integer array
model years are plausible 4-digit positive years
sourceKey unique within snapshot
same TSB code cannot appear twice as separate records
```

The validator must accept `unknown` input and assert/narrow it at runtime. No TypeScript cast is trusted as input validation.

### Aggregating model-year rows

If maintenance extraction initially sees multiple rows for the same TSB code/year data, normalization aggregates them before the B1 snapshot:

```text
144-1064 / 2016
144-1064 / 2017
144-1064 / 2018
       ↓
144-1064 / [2016, 2017, 2018]
```

If the same TSB code appears with conflicting normalized brand/type identities in one snapshot, normalization fails instead of guessing which identity is correct.

## Source string normalization for change detection

Raw strings are preserved for audit/inspection, but stale-mapping comparison uses deterministic normalized identity strings.

Initial normalization is deliberately small:

```text
Unicode normalize
trim
collapse repeated whitespace
case-fold for comparison
normalize common punctuation spacing
```

Do not strip engine sizes, trim names, gearbox words, numbers, or meaningful tokens for identity-change detection.

Example:

```text
"  COROLLA   1.33 LIFE "
```

and

```text
"COROLLA 1.33 LIFE"
```

are equivalent.

But:

```text
COROLLA 1.33 LIFE
COROLLA 1.6 DREAM
```

are materially different.

## Source import algorithm

Maintenance command concept:

```text
pnpm reference:import:vehicle-source -- tsb <normalized-json-path>
```

Algorithm:

1. Parse input as `unknown`.
2. Validate and normalize the complete snapshot.
3. Compute deterministic SHA-256 checksum of normalized content.
4. Open one PostgreSQL transaction.
5. Upsert/find provider by `code`.
6. Insert/find import provenance by provider/version/checksum.
7. For every source record:
   - look up previous row by `(provider_id, source_key)`;
   - compare previous/new normalized brand/type identity;
   - upsert raw fields and sorted years;
   - set `active = true`;
   - preserve `first_seen_import_id`;
   - update `last_seen_import_id`;
   - if a mapping already exists and normalized identity changed materially, set `mapping_needs_review = true`.
8. Mark provider records missing from the new snapshot `active = false`.
9. Preserve mapping rows for inactive records for historical/audit continuity.
10. Commit.
11. Return deterministic summary.

Idempotent replay of the same normalized snapshot must not create duplicate provider/import/source rows and must not change clean mapping state.

## Reactivation behavior

If a previously inactive TSB code reappears:

- reuse the same `vehicle_source_records.id`;
- set `active = true`;
- update `last_seen_import_id` and metadata;
- preserve the existing mapping;
- if normalized identity differs from the previously stored identity, set `mapping_needs_review = true`.

## Stale mapping behavior

The key guardrail is:

```text
same source key + materially changed normalized source identity + existing mapping
        ↓
mapping_needs_review = true
```

The mapping row is retained, but reporting treats it as untrusted until explicitly confirmed or changed.

The source importer itself never clears `mapping_needs_review`.

Only an explicit reviewed mapping apply/confirm operation may clear it.

## Repository-owned mapping file

Reviewed source-to-canonical decisions live in Git as a small curation artifact, not as raw TSB data.

Path:

```text
data/reference/vehicles/tsb-mappings.json
```

Conceptual shape:

```json
{
  "version": "2026-09-08.1",
  "mappings": [
    {
      "sourceKey": "144-1064",
      "vehicleModelKey": "toyota:corolla:1-33-life",
      "method": "curated-import"
    }
  ]
}
```

The mapping file references stable repository identities:

- TSB `sourceKey`;
- Bizzat canonical `vehicle_models.catalog_key`.

It does **not** hard-code database UUIDs.

## Mapping apply algorithm

Maintenance command concept:

```text
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/tsb-mappings.json
```

Algorithm:

1. Parse mapping file as `unknown` and validate it.
2. Open one DB transaction.
3. Resolve provider `tsb-kasko`.
4. For each mapping:
   - resolve source record by provider + `sourceKey`;
   - resolve canonical model by `catalog_key`;
   - reject missing source record;
   - reject missing canonical model;
   - upsert `vehicle_source_mappings`;
   - set/replace `mapping_method`;
   - clear that source record's `mapping_needs_review`.
5. Do not delete unrelated mappings merely because they are absent from the mapping file unless the file explicitly adopts full-snapshot semantics in a later design.
6. Commit.

Initial mapping files are therefore **patch/apply artifacts**, not authoritative delete-all snapshots.

This avoids accidental mapping loss while the Turkey catalog is being curated incrementally.

## Mapping report

B1 provides a deterministic maintenance report command.

Concept:

```text
pnpm reference:report:vehicle-source -- tsb
```

Summary:

```json
{
  "provider": "tsb-kasko",
  "activeRecords": 100,
  "trustedMapped": 60,
  "unmapped": 35,
  "reviewRequired": 5,
  "inactiveRecords": 7
}
```

Definitions:

- `trustedMapped`: active source record + mapping exists + `mapping_needs_review = false`;
- `unmapped`: active source record + no mapping;
- `reviewRequired`: active source record + mapping exists + `mapping_needs_review = true`;
- `inactiveRecords`: source record no longer present in current snapshot.

A mapping to an inactive canonical model is not counted as trusted for active source coverage and is reported as review-required or a separate invalid-mapping detail in the human-readable output.

The report may include deterministic detail rows sorted by brand/type/source key, but must not expose TSB kasko price data because it is not stored.

---

# B2 design — Turkey catalog curation and population

## Purpose

B2 turns source coverage into a reviewed product taxonomy. It does not let the importer invent taxonomy automatically.

The workflow is:

```text
TSB source records
 + canonical brands/series
 + brand normalization
 + series aliases
        ↓
candidate generator
        ↓
exact candidates + ambiguous/unmapped report
        ↓
human/agent review
        ↓
catalog.json + tsb-mappings.json
        ↓
canonical import + mapping apply
```

## Brand normalization

Repository-owned file:

```text
data/reference/vehicles/brand-aliases.json
```

Conceptual shape:

```json
{
  "RENAULT (OYAK)": "renault",
  "RENAULT": "renault",
  "VW": "volkswagen",
  "VOLKSWAGEN": "volkswagen"
}
```

Rules:

- alias targets are Bizzat `vehicle_brands.catalog_key` values;
- unknown brand => unmapped candidate, never new canonical brand automatically;
- one raw brand must resolve to at most one canonical brand;
- changes are code-reviewed Git changes.

## Series aliases

Repository-owned file:

```text
data/reference/vehicles/series-aliases.json
```

Conceptual shape:

```json
{
  "renault": {
    "clio": ["CLIO"],
    "megane": ["MEGANE", "MEGANE SEDAN"]
  },
  "fiat": {
    "egea": ["EGEA", "EGEA SEDAN", "EGEA CROSS"]
  }
}
```

Alias targets are Bizzat `vehicle_series.catalog_key` values or are nested under a canonical brand/series key in the concrete implementation.

The final implementation chooses one unambiguous JSON representation and validates all targets against the canonical catalog.

## Candidate-series matching

Candidate matching is deterministic and conservative.

Rules:

1. Resolve brand first.
2. Consider aliases only for that canonical brand.
3. Match normalized token boundaries, not arbitrary substring containment.
4. Prefer the longest explicit alias when one alias is a strict extension of another.
5. If multiple distinct series remain plausible, mark ambiguous.
6. If no alias matches, mark unmapped.
7. Never create a canonical series automatically from an unmatched token.

Examples:

```text
CLIO EVOLUTION 1.0 TCE X-TRONIC 90
        ↓
series candidate = renault:clio
```

```text
GRAND CHEROKEE 3.0 ...
```

must not be misclassified as another series merely because a shorter token appears inside the string.

## Candidate model labels

Candidate generation may propose a final model label after removing an explicitly matched series alias from the source type, but it must remain reviewable.

A proposal may be more explicit than the final desired product label.

Example:

```text
source:
CLIO EVOLUTION 1.0 TCE X-TRONIC 90

candidate:
Evolution 1.0 TCe X-Tronic 90

reviewed canonical label may become:
1.0 TCe Evolution
```

The generator does not need to solve a universal engine/trim grammar.

## Canonical identity during curation

New canonical keys are repository-owned and explicitly reviewed.

Example:

```text
toyota:corolla:1-33-life
```

The key is not mechanically regenerated if display naming is later cleaned up.

B2 may add many canonical models, but it must not introduce `vehicle_generations`, `vehicle_engines`, `vehicle_trims`, or spec tables solely to make parsing easier.

## Candidate generator output

The generator produces a deterministic review artifact/report containing at least:

```text
sourceKey
brandRaw
typeRaw
canonicalBrandCandidate
canonicalSeriesCandidate
proposedModelLabel
status: exact-series | ambiguous-series | unknown-brand | no-series
```

This generated report is not a runtime API and does not become a public data source.

It may be a local/CI artifact rather than a permanently committed large file.

## Human/agent review boundary

An agent or human may assist curation, but approved source-control changes are the authority.

Allowed:

```text
agent proposes catalog/mapping diffs
human/reviewer inspects PR
normal CI validates deterministic rules
merge commits the decisions
```

Not allowed:

```text
live LLM call -> direct production taxonomy mutation
```

## Real Turkey canonical catalog

B2 replaces the tiny Phase A fixture as the operational catalog input with a reviewed file:

```text
data/reference/vehicles/catalog.json
```

The existing Phase A fixture remains a small deterministic test fixture and must not be renamed to imply complete Turkey coverage.

`catalog.json` is Bizzat-owned taxonomy and can contain derived/curated labels; it must not reproduce TSB price data.

## Source manifest

B2 maintains:

```text
data/reference/vehicles/source-manifest.json
```

It records the provenance and role of external inputs used during curation.

For TSB, record at minimum:

```text
name
official page URL
source period/version used
accessed date
role = turkey-coverage
license/terms note = no open redistribution license observed; raw export not committed
```

For open datasets, record:

```text
repository/source URL
pinned commit/version
license
role = nameplate-bootstrap or manual-reference
```

## Coverage success criteria

B2 is not required to map 100% of every TSB vehicle type before the MVP can progress.

The quality gate is:

- all canonical rows in `catalog.json` are valid and reviewable;
- all committed TSB mappings resolve to existing canonical models;
- no ambiguous candidate is silently mapped;
- coverage report clearly shows remaining unmapped/review-required records;
- the MVP automobile catalog has sufficient Turkish-market breadth for listing creation/filtering;
- low-confidence/rare cases may remain unmapped and be curated incrementally.

A numeric minimum percentage is intentionally not hard-coded before the real TSB snapshot is measured.

## Runtime architecture after Phase B

Nothing changes in the live read path:

```text
Next.js
   ↓
GET /api/v1/reference/vehicle/*
   ↓
Fastify
   ↓
vehicle_brands / vehicle_series / vehicle_models
   ↓
PostgreSQL
```

The live API does not join TSB source tables to build dropdowns.

Source tables are maintenance/provenance infrastructure only.

## Transaction boundaries

All source imports and mapping applies use short PostgreSQL transactions.

No external HTTP request or raw file download occurs while a DB transaction is open.

Recommended operational sequence:

```text
acquire official export locally
        ↓
normalize outside DB transaction
        ↓
validate/checksum
        ↓
short source-import transaction
        ↓
report/candidate generation
        ↓
review Git changes
        ↓
canonical import / mapping apply transactions
```

## Error behavior

Maintenance commands fail non-zero on:

- malformed normalized snapshot;
- duplicate source keys;
- conflicting identity for one TSB code within a snapshot;
- invalid year arrays;
- missing provider requirements;
- missing source record during mapping apply;
- missing canonical model key during mapping apply;
- DB transaction failure.

Ambiguous mapping candidates are **not command errors**. They are report outcomes and remain unmapped.

## Testing strategy

### B1 unit tests

Cover:

- runtime validation accepts valid normalized TSB snapshot;
- malformed shape rejected;
- duplicate source code rejected;
- duplicate/unsorted years normalized or rejected according to concrete validator contract;
- whitespace/case-only identity changes compare equal;
- meaningful brand/type changes compare different;
- deterministic normalized checksum.

### B1 PostgreSQL integration tests

Cover:

- source tables/FKs/indexes created;
- first import creates provider/import/source rows;
- identical import is idempotent;
- same TSB code keeps the same source-record UUID;
- model-year metadata updates on the same source row;
- missing source code becomes inactive;
- reappearing source code reuses the same UUID;
- mapped source identity change sets `mapping_needs_review=true`;
- unmapped identity change does not manufacture a mapping;
- mapping apply resolves source key + canonical catalog key;
- mapping apply clears review-required state;
- failed import/apply transaction rolls back;
- report counts trusted/unmapped/review-required deterministically.

### B2 tests

Cover:

- brand alias target validity;
- series alias target validity;
- deterministic brand normalization;
- token-boundary series matching;
- longest-alias preference;
- ambiguous series remains ambiguous;
- unknown brand remains unmapped;
- committed mapping file references valid source/canonical keys;
- canonical catalog remains valid under the Phase A validator/importer;
- public vehicle reference API reads the populated canonical catalog without source metadata.

## Performance

TSB source data is small enough for ordinary PostgreSQL tables and indexed maintenance queries.

Do not add caching/search infrastructure for Phase B.

Candidate matching can run as a maintenance batch in Node/TypeScript using in-memory normalized alias structures plus PostgreSQL/source JSON input.

## Security/privacy

TSB source facts are catalog/reference data, not personal vehicle records.

Do not add:

- VIN;
- plate;
- owner/user data;
- EİDS authorization responses;
- personal insurance policy data.

## Observability

Maintenance CLI output should be structured enough to understand:

```text
source version
checksum
inserted/updated/reactivated/deactivated counts
trusted mapped
unmapped
review required
```

Do not add a metrics/observability platform solely for these maintenance jobs.

## Explicit decisions / rejected alternatives

### Mapping by TSB code + model year

Rejected. It duplicates one source vehicle type across years and creates repeated mapping work.

### Storing TSB prices

Rejected. Price data is not needed for the current Bizzat product requirement and increases data/licensing/scope risk.

### Committing raw TSB exports

Rejected. The public repository does not need raw provider files and no open redistribution license has been established.

### Runtime TSB fetch

Rejected. It creates availability, latency, terms, and schema-change coupling in the product path.

### Automatically creating canonical models for every TSB type

Rejected. TSB `type` is a provider coverage string, not Bizzat's product taxonomy.

### Fuzzy/LLM auto-mapping to reach 100%

Rejected. Ambiguity remains visible rather than being hidden as false precision.

## B1 acceptance criteria

B1 is complete when:

1. TSB source identity is one record per vehicle code, not per year.
2. Multiple model years are stored as metadata on that source record.
3. Raw TSB price values are not persisted.
4. Source/provider/import provenance is persisted.
5. Source imports are idempotent and deactivate/reactivate without changing source UUID.
6. Existing mappings become review-required when normalized source identity changes materially.
7. Explicit mapping apply resolves repository source/canonical keys and can clear review-required state.
8. Deterministic mapped/unmapped/review-required reporting exists.
9. Normal runtime still performs zero TSB/provider calls.
10. PostgreSQL 18 integration tests cover the critical source/mapping lifecycle.

## B2 acceptance criteria

B2 is complete when:

1. brand normalization and series aliases are repository-owned and validated;
2. candidate generation is deterministic and ambiguity fails closed;
3. a reviewed Turkey automobile `catalog.json` exists;
4. reviewed TSB mappings use source codes + canonical catalog keys, not DB UUIDs;
5. source provenance is documented without committing raw TSB exports/prices;
6. canonical import successfully populates PostgreSQL;
7. public vehicle endpoints return the populated canonical hierarchy;
8. coverage reporting exposes remaining unmapped/review-required cases;
9. no runtime LLM/provider dependency is introduced;
10. no unnecessary generation/engine/trim/spec subsystem is introduced.
