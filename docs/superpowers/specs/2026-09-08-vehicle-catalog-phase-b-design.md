# Vehicle Catalog Phase B Design

> 2026-09-09 update: The visible picker hierarchy is superseded by [vehicle picker parity](2026-09-09-vehicle-picker-parity.md), using variable-depth selection paths. Canonical leaf UUIDs and source/mapping guards remain in force.

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
provider = tsb-kasko
source_key = 122-1260
```

A single TSB source record may cover multiple model years.

## Goal

Add a maintenance-only Turkey vehicle coverage and curation layer around the Phase A canonical catalog without making TSB, another provider, or heuristic classification part of the live product runtime.

Phase B must let Bizzat:

1. import normalized TSB vehicle-code facts with provenance;
2. preserve source-record identity across source updates;
3. detect stale mappings when a TSB code's normalized identity changes;
4. maintain reviewed mappings from TSB codes to Bizzat canonical models;
5. generate deterministic mapped/unmapped/review-required/invalid-mapping reports;
6. use TSB and curated aliases to help populate a real Turkey automobile catalog;
7. keep all live listing/public reads on PostgreSQL canonical tables only.

## Non-goals

Phase B does not add:

- TSB as a runtime API dependency;
- automatic scheduled scraping/downloading;
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

The TSB website also does not present an open redistribution license for the raw Kasko dataset. Bizzat therefore uses a conservative operational boundary.

### Allowed maintenance flow

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
- API startup never downloads/imports TSB.
- Deploy/migration never downloads/imports TSB.
- Raw TSB spreadsheets/exports are not committed to the public Bizzat repository.
- TSB kasko price values are not stored in Bizzat's source catalog.
- The source layer stores only the minimum vehicle-identification facts needed for coverage/mapping.
- A small invented/example normalized fixture may live in the repository for tests.
- A production normalized TSB snapshot is operational input, not a repository-owned public redistribution artifact.

This is a data-engineering boundary, not a legal opinion. If TSB later publishes explicit API/licensing terms, source acquisition may change without changing Bizzat canonical identity.

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

`available_model_years` is descriptive source metadata only. It is never a listing-validity gate because TSB coverage is incomplete for older vehicles.

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
- explicit mapping apply CLI;
- stale-mapping detection;
- deterministic source coverage report;
- small deterministic source/mapping fixtures;
- PostgreSQL integration tests;
- CI/docs.

B1 does **not** build the full Turkey canonical catalog.

### B2 — Turkey catalog curation and population

B2 implements:

- canonical brand aliases;
- repository-owned series aliases;
- deterministic candidate generator;
- reviewed `tsb-mappings.json`;
- reviewed real Turkey automobile `catalog.json`;
- source manifest;
- coverage report;
- canonical import and public API verification.

This split keeps source mechanics separate from the large taxonomy/data review.

---

# B1 — source ingestion and mapping

## Database model

### `vehicle_source_providers`

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

`version` is operator-supplied source period/version, for example `2026-09`.

The checksum is computed from the validated normalized snapshot, never from a private/raw spreadsheet file.

### `vehicle_source_records`

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
source_key = trimmed Araç Kodu
```

Provider code is not duplicated inside `source_key`; provider scope already exists in `provider_id`.

### `available_model_years`

Stored as a sorted unique PostgreSQL integer array.

Example:

```text
[2013, 2014, 2015, 2016, 2017, 2018]
```

Rules:

- years are ascending and unique after normalization;
- each year must be an integer from 1886 through `current UTC year + 1`;
- years do not create canonical catalog rows;
- years do not create separate source records;
- years do not restrict `car_details.model_year`.

### `vehicle_source_mappings`

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

### Initial indexes

```text
vehicle_source_records(provider_id, active)
vehicle_source_records(provider_id, mapping_needs_review)
vehicle_source_imports(provider_id, imported_at desc)
vehicle_source_mappings(vehicle_model_id)
```

Do not add fuzzy/text-search indexes in B1.

## Normalized TSB snapshot contract

B1 starts at a normalized JSON boundary. The production raw TSB export remains outside the repository.

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

B1 does not require a public raw-file parser contract. A future local XLS/XLSX/CSV adapter may emit this exact normalized shape, but must not alter DB/domain contracts.

## Snapshot validation

Validation is fail-closed and occurs before a DB transaction.

Exact rules:

```text
provider.code == "tsb-kasko"
provider.sourceName.trim() non-empty
provider.version.trim() non-empty
records is a NON-EMPTY array
sourceKey.trim() non-empty
brandRaw.trim() non-empty
typeRaw.trim() non-empty
availableModelYears is a non-empty integer array
each year is within 1886..current UTC year+1
sourceKey unique within snapshot
```

A completely empty source snapshot is rejected. It must never be interpreted as "deactivate the entire TSB catalog" because an extraction/parser failure could otherwise cause mass deactivation.

The validator accepts `unknown` and narrows/asserts the runtime shape. TypeScript casts do not count as input validation.

## Aggregating year rows

If maintenance extraction sees multiple year rows for one TSB code, normalization aggregates them before B1 import:

```text
144-1064 / 2016
144-1064 / 2017
144-1064 / 2018
       ↓
144-1064 / [2016, 2017, 2018]
```

If one TSB code appears with conflicting normalized brand/type identities in one snapshot, normalization fails rather than choosing one identity.

## Source identity comparison

Raw strings are preserved for inspection, but stale-mapping comparison uses deterministic normalized strings.

Initial normalization:

```text
Unicode NFKC
trim
collapse repeated whitespace
case-fold for comparison
normalize whitespace around simple punctuation
```

Do **not** strip engine size, trim, transmission, power, body, numeric, or other meaningful tokens.

Whitespace/case-only changes are equivalent. Meaningful brand/type changes are different.

## Deterministic checksum

Checksum input is the normalized logical snapshot, not original JSON property order.

Canonicalization before SHA-256:

1. trim provider string values;
2. normalize each record's source/brand/type values according to the validated representation;
3. sort and deduplicate `availableModelYears` ascending;
4. sort records by `sourceKey` ascending;
5. serialize a fixed-key-order object with UTF-8 JSON and no insignificant whitespace;
6. SHA-256 the resulting bytes.

Equivalent logical snapshots therefore produce the same checksum despite input record ordering.

## Source import algorithm

Maintenance command concept:

```text
pnpm reference:import:vehicle-source -- tsb <normalized-json-path>
```

Algorithm:

1. Parse file as `unknown`.
2. Validate/normalize entire snapshot.
3. Compute deterministic normalized SHA-256 checksum.
4. Open one PostgreSQL transaction.
5. Upsert/find provider by `code`.
6. Insert/find import provenance by provider/version/checksum.
7. For every source record:
   - load previous row by `(provider_id, source_key)`;
   - compare previous/new normalized brand/type identity;
   - upsert raw fields and sorted years;
   - set `active=true`;
   - preserve `first_seen_import_id`;
   - update `last_seen_import_id`;
   - if a mapping already exists and normalized identity changed materially, set `mapping_needs_review=true`.
8. Mark provider records missing from the new non-empty snapshot `active=false`.
9. Preserve mapping rows for inactive records.
10. Commit.
11. Return deterministic inserted/updated/reactivated/deactivated/review-required-set counts.

Replay of the same normalized snapshot is idempotent and must not manufacture new rows or dirty clean mappings.

## Reactivation

If an inactive TSB code reappears:

- reuse the same source-record UUID;
- set `active=true`;
- update last-seen import and metadata;
- preserve mapping row;
- if normalized identity differs materially, set `mapping_needs_review=true`.

## Stale mapping guard

```text
same source key
+ materially changed normalized source identity
+ existing mapping
        ↓
mapping_needs_review = true
```

The mapping row remains, but is not treated as trusted until explicit review.

The source importer never clears `mapping_needs_review`.

Only explicit mapping apply/confirm may clear it.

## Repository mapping file

Reviewed decisions live in Git as a small curation artifact, not as raw TSB data.

Path:

```text
data/reference/vehicles/tsb-mappings.json
```

Shape:

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

The file uses TSB source code + Bizzat `vehicle_models.catalog_key`, never DB UUIDs.

## Mapping apply algorithm

Maintenance command concept:

```text
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/tsb-mappings.json
```

Algorithm:

1. Parse mapping file as `unknown`; validate version, unique source keys, model keys, allowed methods.
2. Open one DB transaction.
3. Resolve provider `tsb-kasko`.
4. For each mapping:
   - resolve source record by provider + sourceKey;
   - resolve canonical model by catalog_key;
   - reject missing source record;
   - reject missing canonical model;
   - reject an inactive canonical target for a new/updated mapping;
   - upsert mapping/method;
   - clear `mapping_needs_review` on that source record.
5. Do not delete unrelated mappings merely because they are absent from the file.
6. Commit.

Initial mapping files are patch/apply artifacts, not delete-all authoritative snapshots.

## Source coverage report

Maintenance command concept:

```text
pnpm reference:report:vehicle-source -- tsb
```

Summary shape:

```json
{
  "provider": "tsb-kasko",
  "activeRecords": 100,
  "trustedMapped": 55,
  "unmapped": 35,
  "reviewRequired": 5,
  "invalidMappings": 5,
  "inactiveRecords": 7
}
```

Definitions:

- `trustedMapped`: active source + mapping + `mapping_needs_review=false` + canonical target active;
- `unmapped`: active source + no mapping;
- `reviewRequired`: active source + mapping + `mapping_needs_review=true`;
- `invalidMappings`: active source + mapping target exists but canonical model is inactive;
- `inactiveRecords`: source no longer present in current snapshot.

`invalidMappings` is derived report state; it does not mutate `mapping_needs_review` because source identity may be perfectly stable while product taxonomy has been deactivated.

Detail rows are deterministic and sorted by normalized brand/type/source key.

TSB kasko prices never appear because they are not stored.

---

# B2 — Turkey catalog curation and population

## Purpose

B2 turns source coverage into a reviewed product taxonomy. It does not let TSB import reshape canonical taxonomy automatically.

```text
TSB source records
 + canonical brands/series
 + brand aliases
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

## Brand aliases

Path:

```text
data/reference/vehicles/brand-aliases.json
```

Exact shape:

```json
{
  "version": "2026-09-08.1",
  "aliases": [
    { "raw": "RENAULT (OYAK)", "brandKey": "renault" },
    { "raw": "RENAULT", "brandKey": "renault" },
    { "raw": "VW", "brandKey": "volkswagen" },
    { "raw": "VOLKSWAGEN", "brandKey": "volkswagen" }
  ]
}
```

Rules:

- each normalized `raw` alias is unique;
- `brandKey` must resolve to a canonical `vehicle_brands.catalog_key`;
- unknown brand aliases do not create canonical brands automatically;
- changes are ordinary reviewed Git changes.

## Series aliases

Path:

```text
data/reference/vehicles/series-aliases.json
```

Exact shape:

```json
{
  "version": "2026-09-08.1",
  "entries": [
    {
      "brandKey": "renault",
      "seriesKey": "renault:clio",
      "aliases": ["CLIO"]
    },
    {
      "brandKey": "renault",
      "seriesKey": "renault:megane",
      "aliases": ["MEGANE", "MEGANE SEDAN"]
    },
    {
      "brandKey": "fiat",
      "seriesKey": "fiat:egea",
      "aliases": ["EGEA", "EGEA SEDAN", "EGEA CROSS"]
    }
  ]
}
```

Validation:

- `brandKey` must exist and be active in canonical input;
- `seriesKey` must exist, be active, and belong to `brandKey`;
- normalized aliases are non-empty;
- within one brand, one normalized alias may map to only one series;
- duplicates within an entry are rejected/normalized deterministically.

## Candidate-series matching

Rules:

1. Resolve canonical brand first.
2. Consider series aliases only for that brand.
3. Match normalized token boundaries, not arbitrary substring containment.
4. Prefer the longest matching alias when aliases for the same brand overlap.
5. If equally specific aliases point to different series, result is ambiguous.
6. No match => unmapped/no-series.
7. Never create a canonical series automatically.

Example:

```text
CLIO EVOLUTION 1.0 TCE X-TRONIC 90
        ↓
series candidate = renault:clio
```

The matcher must not classify a longer nameplate as a shorter unrelated series merely because a substring appears inside it.

## Candidate model labels

After exact brand/series resolution, the generator may propose a model label by removing the matched series alias and normalizing presentation.

Example:

```text
source:
CLIO EVOLUTION 1.0 TCE X-TRONIC 90

candidate:
Evolution 1.0 TCe X-Tronic 90

reviewed canonical label may become:
1.0 TCe Evolution
```

The generator does not need a universal engine/trim grammar. The proposal remains a review artifact.

## Candidate output

At minimum:

```text
sourceKey
brandRaw
typeRaw
brandKeyCandidate
seriesKeyCandidate
proposedModelLabel
status: exact-series | ambiguous-series | unknown-brand | no-series
```

Generated candidate output is not a runtime API or authoritative public data source. It may be local/CI artifact instead of a permanently committed large file.

## Human/agent review boundary

Allowed:

```text
agent proposes catalog/mapping diffs
reviewer inspects PR
CI validates deterministic contracts
merge commits decisions
```

Not allowed:

```text
live LLM/provider call -> direct production taxonomy mutation
```

## Real Turkey canonical catalog

B2 creates the operational canonical file:

```text
data/reference/vehicles/catalog.json
```

It follows the existing Phase A canonical import contract.

The small Phase A fixture remains a test/dev fixture and must not be renamed to imply complete Turkey coverage.

The canonical file contains Bizzat-owned taxonomy labels only; no TSB kasko prices.

## Source manifest

Path:

```text
data/reference/vehicles/source-manifest.json
```

For each material external input record:

```text
name
source URL
pinned commit/version/source period
accessed date
license/terms note
role
```

For TSB:

```text
role = turkey-coverage
license/terms note = no open redistribution license observed; raw export not committed
```

For open bootstrap sources, record exact pinned commit/version + license.

## Coverage success criteria

B2 does not require 100% of every TSB type before the rest of the MVP can progress.

Quality gates:

- every canonical row is valid/reviewable;
- every committed mapping resolves to an existing active canonical model at apply time;
- ambiguous candidates are never silently mapped;
- report exposes remaining unmapped/review-required/invalid cases;
- canonical catalog has practical Turkish-market breadth for automobile listing creation/filtering;
- rare/uncertain types may remain unmapped and be curated incrementally.

No numeric percentage is hard-coded before the first real normalized TSB snapshot is measured.

## Runtime after Phase B

Live read path stays unchanged:

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

The public API never joins source tables to construct dropdowns.

## Transaction boundaries

No external HTTP/file acquisition occurs inside a DB transaction.

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
short canonical-import / mapping-apply transactions
```

## Error behavior

Maintenance commands fail non-zero on:

- malformed snapshot/mapping/alias file;
- empty TSB snapshot;
- duplicate source keys;
- conflicting identity for one TSB code in one snapshot;
- invalid year arrays;
- missing source record during mapping apply;
- missing/inactive canonical model during mapping apply;
- invalid alias targets;
- DB transaction failure.

Ambiguous candidate results are report outcomes, not command errors.

## Testing strategy

### B1 unit tests

- valid runtime snapshot validation;
- malformed shape rejected;
- empty snapshot rejected;
- duplicate source code rejected;
- year normalization/range behavior;
- case/whitespace-only identity change compares equal;
- meaningful source identity change compares different;
- deterministic checksum independent of record/year input order;
- mapping file runtime validation.

### B1 PostgreSQL integration tests

- source tables/FKs/indexes;
- first import creates provenance/source rows;
- identical import idempotent;
- same TSB code preserves source UUID;
- year metadata updates on same source row;
- missing source becomes inactive;
- reappearing source reuses UUID;
- mapped identity change sets review flag;
- unmapped identity change does not manufacture mapping;
- mapping apply resolves source + active canonical key;
- mapping apply clears review flag;
- mapping to inactive canonical target rejected;
- failed import/apply rolls back;
- report counts trusted/unmapped/review-required/invalid deterministically.

### B2 tests

- brand alias target validity/uniqueness;
- series alias target validity/uniqueness;
- deterministic brand normalization;
- token-boundary series matching;
- longest-alias preference;
- equal-specificity ambiguity fails closed;
- unknown brand remains unmapped;
- committed mapping file references valid source/canonical keys;
- `catalog.json` passes Phase A validator/importer;
- public vehicle API reads populated canonical catalog with no source metadata.

## Performance

Ordinary PostgreSQL tables and B-tree indexes are sufficient. Candidate matching is maintenance batch work and can use in-memory alias maps.

No Redis/search/cache infrastructure is added.

## Security/privacy

Source facts are catalog/reference data only.

Do not store:

- VIN;
- plate;
- owner/user data;
- policy/personal insurance data;
- EİDS authorization responses.

## Explicit rejected approaches

### TSB mapping by vehicle code + model year

Rejected because it duplicates one source type across years.

### Storing TSB kasko prices

Rejected because Bizzat does not need them for the current product requirement and they increase scope/data-rights risk.

### Committing raw TSB exports

Rejected because the public repo does not need provider raw files and no open redistribution license has been established.

### Runtime TSB fetch

Rejected because it couples product availability/latency/schema/terms to an external maintenance source.

### Automatically creating canonical models for every TSB type

Rejected because TSB `type` is provider coverage text, not Bizzat product taxonomy.

### Fuzzy/LLM auto-mapping to reach 100%

Rejected. Ambiguity remains visible.

## B1 acceptance criteria

B1 is complete when:

1. TSB source identity is one record per vehicle code, not per year.
2. Multiple model years are metadata on that source record.
3. Empty source snapshots fail closed.
4. TSB kasko prices are not persisted.
5. provider/import provenance is persisted.
6. source imports are idempotent and preserve UUID through deactivate/reactivate.
7. materially changed mapped source identity sets `mapping_needs_review=true`.
8. explicit mapping apply uses source code + canonical catalog key and can clear review state.
9. deterministic trusted/unmapped/review-required/invalid reporting exists.
10. runtime still performs zero TSB/provider calls.
11. PostgreSQL 18 integration tests cover the source/mapping lifecycle.

## B2 acceptance criteria

B2 is complete when:

1. brand/series aliases are repository-owned and validated;
2. candidate generation is deterministic and ambiguity fails closed;
3. reviewed Turkey automobile `catalog.json` exists;
4. reviewed TSB mappings use source codes + canonical keys, not DB UUIDs;
5. provenance is documented without committing raw TSB exports/prices;
6. canonical import populates PostgreSQL successfully;
7. public vehicle endpoints return the populated canonical hierarchy;
8. coverage reporting exposes remaining unmapped/review-required/invalid cases;
9. no runtime LLM/provider dependency is introduced;
10. no unnecessary generation/engine/trim/spec subsystem is introduced.
