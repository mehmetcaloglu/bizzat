# Vehicle Catalog Design

> 2026-09-09 update: The visible picker hierarchy is superseded by [vehicle picker parity](2026-09-09-vehicle-picker-parity.md), using variable-depth selection paths. Canonical leaf UUIDs and source/mapping guards remain in force.

Date: 2026-09-08
Status: Approved in chat, awaiting written-spec review

## Goal

Provide Bizzat with a stable, self-hosted automobile catalog for the MVP so listing creation and filtering can use a familiar hierarchy:

```text
Marka -> Seri -> Model
```

The application must not depend on a hosted vehicle API during normal runtime, and listings must never use a third-party provider's IDs as their domain identity.

The first implementation covers only the MVP automobile catalog. Other vehicle classes such as SUV/pickup, motorcycle, commercial vehicle, caravan, marine, etc. remain follow-up work even if a source dataset contains them.

## Core decision

Bizzat owns the canonical catalog.

```text
Bizzat canonical catalog
  vehicle_brands
  vehicle_series
  vehicle_models
        ^
        |
source mappings / curation
        |
TSB + open nameplate inputs + Bizzat overrides
```

A listing stores Bizzat IDs:

```text
car_details.make_id   -> vehicle_brands.id
car_details.series_id -> vehicle_series.id
car_details.model_id  -> vehicle_models.id
```

It never stores a TSB vehicle code, OtoAPI ID, or other provider ID as the listing's canonical vehicle identity.

This is the main portability rule for the subsystem.

## Why this approach

### TSB is valuable but not the taxonomy

The Insurance Association of Turkiye (TSB) Kasko Value List is highly relevant to the Turkish market and includes vehicles up to 15 model years old. Its useful source fields include concepts equivalent to:

- vehicle code
- make/brand
- type description
- model year

However, a TSB type description can be much more detailed than Bizzat's intended `Marka -> Seri -> Model` picker. It may include engine, gearbox, power, trim or body information in one source string.

Therefore:

- TSB is a Turkey coverage and mapping source;
- TSB is not Bizzat's canonical taxonomy;
- TSB source strings are never exposed as authoritative application IDs.

### Hosted commercial catalog APIs are not the foundation

A hosted vehicle API would be operationally easy but conflicts with the project's self-hosted and portable architecture. It also creates cost, terms-of-use, bulk-data, derivative-database and provider-lock-in risks.

OtoAPI is explicitly not an ingestion dependency for the canonical catalog.

### Open nameplate data is a curation aid, not Turkey truth

Open datasets can help bootstrap recognizable make/nameplate relationships such as `Fiat -> Egea`, `Renault -> Clio`, or `Volkswagen -> Golf`.

A currently inspected example is `serhatkildaci/global-car-models`, pinned at commit:

```text
44da5c9e5e0f3162d65579033f7a641473308b11
```

It is MIT-licensed and contains brand -> model/nameplate lists, including Turkey-relevant names such as Egea.

This source can assist initial curation, but it is community-maintained and is not treated as an official Turkish market registry.

VehiclesDB is also useful as a nameplate-quality reference and is CC-BY 4.0, but its current official-source coverage is not a dedicated Turkish catalog. It is therefore optional research/curation input rather than a required runtime or ingestion dependency.

## Product taxonomy semantics

The three levels mean:

### Brand / Marka

Manufacturer or market brand.

Examples:

```text
Renault
Fiat
Volkswagen
Toyota
```

### Series / Seri

The recognizable product line/nameplate used for the second picker level.

Examples:

```text
Renault -> Clio
Fiat -> Egea
Volkswagen -> Golf
Toyota -> Corolla
```

This level must not contain engine, gearbox or trim details.

### Model / Model

The final selectable catalog label below a series.

Examples:

```text
Renault -> Clio -> 1.0 TCe Joy
Renault -> Clio -> 1.0 TCe Evolution
Fiat -> Egea -> 1.4 Fire Easy
```

The first imported labels do not need to match Sahibinden wording byte-for-byte. The important invariant is that the final level is understandable and stable under the correct series.

A model's display name may later be curated/renamed without changing its Bizzat ID or stable catalog key.

## What is NOT part of the canonical catalog

These remain listing attributes in `car_details` and do not become catalog hierarchy tables in the first phase:

- model year
- fuel type
- transmission
- vehicle condition
- mileage
- body type
- engine power
- engine displacement
- drivetrain
- color
- warranty
- heavy damage status
- plate/nationality state
- swap status
- paint/replacement state

This preserves the earlier database design: taxonomy identifies the vehicle family/variant; listing-specific filter values stay on the listing.

## No `vehicle_model_years` table in the first phase

The earlier sketch included `vehicle_model_years`. It is intentionally removed from the first implementation.

Reason:

- TSB currently covers only up to 15 model years;
- older used cars must still be listable;
- an incomplete source must not become a false validity gate;
- `car_details.model_year` already stores the listing's year directly.

TSB model year remains source metadata used for coverage/mapping/review. It does not define which years Bizzat permits a user to list.

A model-year availability table may be introduced later only if Bizzat obtains sufficiently complete historical coverage and the product actually needs model-specific year validation.

## Canonical data model

### `vehicle_brands`

Fields:

- `id` UUID primary key, default `uuidv7()`
- `catalog_key` text unique, stable machine identifier
- `name` text
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Example:

```text
catalog_key = renault
name = Renault
```

### `vehicle_series`

Fields:

- `id` UUID primary key
- `brand_id` FK -> `vehicle_brands.id`
- `catalog_key` text unique
- `name` text
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Example:

```text
catalog_key = renault:clio
name = Clio
```

Indexes:

- `(brand_id, active, name)`

### `vehicle_models`

Fields:

- `id` UUID primary key
- `series_id` FK -> `vehicle_series.id`
- `catalog_key` text unique
- `name` text
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Example:

```text
catalog_key = renault:clio:1-0-tce-evolution
name = 1.0 TCe Evolution
```

Indexes:

- `(series_id, active, name)`

### Stable key rule

Display names are mutable. `catalog_key` is stable.

A rename:

```text
1.0 TCE Evolution
        ->
1.0 TCe Evolution
```

must update the same row, not create a new model.

Keys are explicit repository-owned identifiers. Do not automatically regenerate a key when a display name changes.

## Source provenance model

The canonical catalog is separate from source records.

### `vehicle_source_providers`

Fields:

- `id` UUID primary key
- `code` text unique
- `source_name` text
- `source_url` text nullable
- `license` text nullable
- `created_at` timestamptz

Initial provider example:

```text
code = tsb-kasko
```

### `vehicle_source_imports`

Fields:

- `id` UUID primary key
- `provider_id` FK
- `version` text
- `checksum_sha256` text
- `imported_at` timestamptz

Uniqueness:

```text
(provider_id, version, checksum_sha256)
```

### `vehicle_source_records`

Represents normalized source facts from one provider.

Fields:

- `id` UUID primary key
- `provider_id` FK
- `source_key` text
- `brand_raw` text
- `type_raw` text
- `model_year` integer nullable
- `active` boolean default true
- `mapping_needs_review` boolean default false
- `first_seen_import_id` FK
- `last_seen_import_id` FK
- `created_at` timestamptz
- `updated_at` timestamptz

Uniqueness:

```text
(provider_id, source_key)
```

For a TSB import, the normalizer must construct a stable provider-scoped `source_key`. If the raw vehicle code alone is not unique across model years, the source key includes the model year as part of the provider-specific key.

Example:

```text
tsb-kasko:122-1260:2024
```

The source key is infrastructure detail and never leaks into public listing contracts.

Source identity fields are normalized before comparison. If a previously mapped source record keeps the same `source_key` but its normalized brand/type identity changes materially, the import sets `mapping_needs_review = true`. An existing mapping is not treated as trusted until maintenance review confirms or updates it.

### `vehicle_source_mappings`

Fields:

- `source_record_id` PK/FK -> `vehicle_source_records.id`
- `vehicle_model_id` FK -> `vehicle_models.id`
- `mapping_method` text
- `created_at` timestamptz
- `updated_at` timestamptz

Allowed initial methods:

```text
manual
exact-rule
curated-import
```

No numeric confidence model is needed initially.

No mapping row means `unmapped`.

A mapping with `vehicle_source_records.mapping_needs_review = true` is reported separately as stale/review-required and is not counted as a clean trusted mapping.

Creating or confirming a mapping clears `mapping_needs_review` in the same maintenance transaction.

The importer does not silently invent a mapping just to reach 100% coverage.

## Repository-owned canonical snapshot

Canonical vehicle taxonomy is maintained in source control as a normalized file, for example:

```text
data/reference/vehicles/catalog.json
```

Conceptual shape:

```json
{
  "version": "2026-09-08.1",
  "brands": [
    {
      "key": "renault",
      "name": "Renault",
      "series": [
        {
          "key": "renault:clio",
          "name": "Clio",
          "models": [
            {
              "key": "renault:clio:1-0-tce-evolution",
              "name": "1.0 TCe Evolution"
            }
          ]
        }
      ]
    }
  ]
}
```

This file is the human-reviewable canonical taxonomy input.

Database imports are derived from this file; the database is the runtime copy.

## Curation inputs

Curation is deliberately offline/maintenance work.

Potential inputs:

1. TSB Kasko data for Turkish market coverage and detailed raw type/year records.
2. MIT/open nameplate lists for brand -> series bootstrap.
3. Manufacturer/public factual sources when needed to resolve ambiguity.
4. Bizzat repository overrides for Turkish market naming differences and ambiguous source strings.

Example override area:

```text
data/reference/vehicles/
  catalog.json
  series-aliases.json
  source-manifest.json
```

`series-aliases.json` is maintenance input, not runtime domain data.

Example conceptual alias:

```json
{
  "fiat": {
    "egea": ["EGEA", "EGEA SEDAN", "EGEA CROSS"]
  }
}
```

Aliases help identify a candidate series. They do not automatically define all final model labels.

## Candidate mapping strategy

The system may generate mapping candidates during maintenance, but ambiguity must fail closed.

Safe workflow:

```text
TSB normalized source records
        +
canonical brand/series + aliases
        ↓
candidate generator
        ↓
exact candidates / unmapped report
        ↓
human or agent review
        ↓
committed canonical catalog / mapping file
        ↓
explicit DB import
```

Rules:

- brand match must be deterministic;
- series candidate must use explicit alias/name boundaries, not arbitrary substring guessing;
- multiple plausible series candidates => unmapped;
- no matching series => unmapped;
- stale mappings with `mapping_needs_review = true` require review before being counted as trusted;
- an LLM is never called in the live listing request path;
- an LLM must not directly mutate production taxonomy without a reviewed repository change;
- a maintenance agent may help propose mappings, but the result is a normal code/data review artifact.

## Model-label strategy

The first catalog does not need a perfect universal trim ontology.

When an approved source mapping gives a detailed source type such as:

```text
CLIO EVOLUTION 1.0 TCE X-TRONIC 90
```

and the series is confidently `Clio`, Bizzat may initially use a curated model label such as:

```text
1.0 TCe Evolution
```

or, if the normalization cannot safely collapse technical tokens without changing meaning, a more explicit label such as:

```text
Evolution 1.0 TCe X-Tronic 90
```

The important rule is not perfect naming on day one; it is stable identity and correct parent series.

Later naming cleanup changes `name`, not `catalog_key` or listing foreign keys.

## Canonical catalog import behavior

Root maintenance command concept:

```text
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/catalog.json
```

Algorithm:

1. Load the repository-owned normalized catalog.
2. Validate unique keys and non-empty names.
3. Validate complete parent relationships.
4. Start one PostgreSQL transaction.
5. Upsert brands by `catalog_key`.
6. Upsert series by `catalog_key`, resolving brand FK.
7. Upsert models by `catalog_key`, resolving series FK.
8. Mark missing canonical rows inactive instead of deleting them.
9. Commit.

Deactivation happens child-to-parent:

```text
models -> series -> brands
```

Historical listing foreign keys remain valid.

The import is explicit maintenance work. API startup never imports vehicle data.

## TSB source import behavior

TSB import is a separate maintenance command from canonical taxonomy import.

Concept:

```text
pnpm reference:import:vehicle-source -- tsb <normalized-tsb-file>
```

Algorithm:

1. Load normalized TSB snapshot/export.
2. Validate required source fields.
3. Compute checksum.
4. Insert/find provider and import metadata.
5. Upsert source records by provider + source key.
6. Update `last_seen_import_id` and normalized raw fields.
7. If normalized source identity changes for an already mapped record, set `mapping_needs_review = true`.
8. Mark source records missing from the new snapshot inactive.
9. Preserve mapping rows, but treat review-required mappings as stale until explicitly confirmed or changed.
10. Produce mapped/unmapped/stale/change summary.

This command does not create new canonical brand/series/model rows automatically.

That separation is intentional: source updates cannot silently reshape the product taxonomy.

## Public API

Read-only public endpoints:

```text
GET /api/v1/reference/vehicle/brands
GET /api/v1/reference/vehicle/brands/:brandId/series
GET /api/v1/reference/vehicle/series/:seriesId/models
```

Responses contain only Bizzat canonical IDs and display fields.

Example:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Renault"
    }
  ]
}
```

Unknown or inactive parent IDs return `404` with the common API error shape.

No source-provider fields are exposed in public catalog responses.

## Listing integration

When automobile listing creation is implemented:

- `make_id` must reference an active `vehicle_brands` row;
- `series_id` must reference an active series belonging to `make_id`;
- `model_id` must reference an active model belonging to `series_id`;
- model year remains an independent numeric listing field;
- fuel/transmission/body/engine/etc. remain independent listing attributes.

The API/service validates hierarchy consistency before creating or updating a listing.

The database uses foreign keys for row existence; service-level validation enforces selected parent-child consistency and active-state rules.

## Error handling

Reference endpoints reuse the common API error shape.

Existing/general reference parent errors may be reused if their semantics remain clear. Do not create a new error code for every hierarchy level unless the frontend actually needs distinct behavior.

Maintenance imports fail closed:

- duplicate canonical keys => reject import;
- orphan series/model => reject import;
- malformed source record => reject source import;
- DB failure => rollback transaction;
- ambiguous source mapping => remain unmapped, not guessed;
- stale source mapping => requires review, not silently trusted.

## Initial implementation decomposition

This subsystem should not become one giant PR.

### Phase A — Canonical catalog foundation

Implement:

- `vehicle_brands`
- `vehicle_series`
- `vehicle_models`
- canonical JSON schema/validator/importer
- small deterministic fixture
- public brand/series/model endpoints
- PostgreSQL integration tests
- docs/CI

This phase proves the product-facing hierarchy without TSB complexity.

### Phase B — Turkey source coverage and mapping

Implement:

- `vehicle_source_providers`
- `vehicle_source_imports`
- `vehicle_source_records`
- `vehicle_source_mappings`
- normalized TSB source importer
- stale-mapping guard
- candidate/unmapped/stale report
- repository mapping/alias workflow
- real initial Turkish catalog population/curation

This split keeps the first PR understandable and reviewable while preserving the final architecture.

## Testing

### Canonical validator unit tests

Cover:

- duplicate brand key
- duplicate series key
- duplicate model key
- blank names
- orphan series
- orphan model
- deterministic checksum if canonical snapshots use checksums

### PostgreSQL integration tests

Run against PostgreSQL 18:

- migration creates canonical tables and FKs;
- first canonical import inserts hierarchy;
- same import is idempotent;
- display rename preserves row ID;
- missing model becomes inactive;
- reintroduced model reuses same ID;
- parent FK constraints are enforced;
- failed import rolls back.

Phase B additionally tests:

- source provider/import provenance;
- source-record idempotency;
- same source key preserves row ID;
- missing source record becomes inactive;
- mapped and unmapped counts are deterministic;
- normalized identity change marks an existing mapping review-required;
- confirming/changing the mapping clears review-required state;
- ambiguous candidate is not automatically mapped.

### API tests

- brands returns only active brands;
- series is scoped to active brand;
- models is scoped to active series;
- unknown/inactive parent returns 404;
- source metadata never appears in public response.

No repository mock substitutes for DB integration coverage.

## Performance

The canonical catalog is tiny compared with listing data. Simple B-tree indexes on parent IDs + active/name are enough.

Do not add:

- Redis
- Elasticsearch/OpenSearch
- in-memory distributed cache
- materialized views
- partitioning
- full-text search

for this subsystem.

If the frontend later wants fast local dropdown transitions, HTTP/client caching can be added without changing the catalog model.

## Security and privacy

Vehicle catalog/source data is public reference data.

Do not store:

- VINs
- license plates
- owner information
- EIDS user/vehicle authorization responses

inside this subsystem.

TSB source records represent catalog facts only, not individual vehicles.

## Licensing/provenance rules

Every external input used to materially populate the repository-owned catalog must have documented provenance.

`data/reference/vehicles/source-manifest.json` should record, where applicable:

- source name
- source URL
- pinned commit/version/date
- license/terms status
- role in curation (`nameplate-bootstrap`, `turkey-coverage`, `manual-reference`, etc.)

Do not ingest a source whose redistribution/derivative-database terms are incompatible with the intended repository-owned catalog.

Open-source attribution requirements must be preserved where the selected source license requires them.

## Explicitly rejected approaches

### Third-party hosted API as runtime source of truth

Rejected because it introduces runtime dependency, provider lock-in, cost and terms risk.

### TSB type string as canonical model ID

Rejected because provider wording is not Bizzat domain identity and can be more detailed than the intended product taxonomy.

### One giant `vehicles` table with brand/series/model strings

Rejected because hierarchy integrity, active/deactivation behavior and stable references become harder to enforce.

### Automatic LLM taxonomy generation at listing time

Rejected because it is nondeterministic, adds latency/cost and can silently classify vehicles incorrectly.

### Full generation/engine/trim/spec relational engine now

Rejected as premature. Do not add `vehicle_generations`, `vehicle_engines`, `vehicle_trims`, `vehicle_specs` or VIN decoding until a concrete product requirement needs them.

## Out of scope

- non-automobile vehicle categories
- VIN decoding
- exact manufacturer specification database
- generations/chassis codes
- engine-code catalog
- option packages
- equipment lists
- new/used market prices
- TSB kasko values as a product feature
- automatic scheduled source synchronization
- admin catalog UI
- live hosted vehicle API dependency

## Acceptance criteria

The overall vehicle-catalog subsystem is complete when:

1. Listings can reference stable Bizzat brand/series/model IDs.
2. Canonical taxonomy is human-reviewable and versioned in the repository.
3. Renaming display text does not change catalog identity.
4. Removed catalog entries become inactive rather than being hard-deleted.
5. Public brand -> series -> model endpoints read only from PostgreSQL.
6. Normal runtime has zero dependency on TSB or another vehicle API.
7. TSB records can be tracked separately with provider/import provenance.
8. TSB mappings never replace Bizzat canonical IDs.
9. Ambiguous source records remain unmapped rather than guessed.
10. Changed source identity cannot silently keep a stale mapping trusted.
11. `model_year` remains an independent listing field and older vehicles are not blocked by TSB's 15-year coverage window.
12. Real PostgreSQL integration tests cover import identity/deactivation/FK behavior.
13. No unnecessary vehicle-spec engine, cache, search service or microservice is introduced.
