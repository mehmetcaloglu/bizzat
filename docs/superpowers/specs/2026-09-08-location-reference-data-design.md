# Location Reference Data Design

Date: 2026-09-08
Status: Approved

## Goal

Provide Bizzat with stable, queryable Turkish province/district/neighborhood reference data without making normal application traffic depend on an external address service.

This subsystem covers:

- provinces
- districts
- neighborhoods
- stable provider identity
- per-import version/checksum provenance
- explicit normalized-snapshot import tooling
- public read-only hierarchy endpoints

Vehicle make/series/model data is a separate follow-up subsystem and PR.

## Product boundary

The subsystem supports listing creation and filtering. It must not:

- call a third-party location API during ordinary web/API requests
- import data during API startup or deploy
- introduce Redis, queues, Elasticsearch, GIS, replicas, partitioning, or another service
- treat a community dataset as an official government source
- match administrative entities by display name alone
- hard-delete disappeared administrative entities
- expose source/provider metadata through the public reference API

## Source strategy

Turkey's official administrative/address truth is maintained by public-sector systems such as NVI/AKS and related official datasets. Bizzat preserves that distinction.

The initial operational source is pinned to:

```text
provider code: turkey-geo-api
repository: https://github.com/onurusluca/turkey-geo-api
version: 1.3
commit: 5a16cef20f2335e3fe643c9618f931866bb8134c
source date: 2026-04-14
license: MIT
```

The pinned upstream snapshot reports 81 provinces, 973 districts, and 73,496 neighborhoods. Street-level data is intentionally excluded.

This is an operational snapshot, not an official NVI mirror.

The application importer consumes a **normalized Bizzat snapshot JSON**. Source-specific extraction/normalization is a maintenance pre-step, not part of runtime request handling. The repository stores a small deterministic normalized fixture and a pinned source manifest rather than vendoring the upstream street-heavy dataset.

## Runtime architecture

Normal read flow:

```text
Web -> Fastify /api/v1/reference/* -> PostgreSQL
```

Maintenance flow:

```text
Reviewed pinned source
  -> normalize to Bizzat snapshot JSON
  -> explicit CLI validator/importer
  -> PostgreSQL transaction
```

No external HTTP dependency exists in the runtime read path.

## Data model

### `reference_data_providers`

Stable source/provider identity.

Fields:

- `id` UUID primary key, generated with PostgreSQL `uuidv7()`
- `code` text unique
- `source_name` text
- `source_url` text nullable
- `license` text nullable
- `created_at` timestamptz

### `reference_data_imports`

One imported provider snapshot/version.

Fields:

- `id` UUID primary key
- `provider_id` FK -> `reference_data_providers.id`
- `version` text
- `checksum_sha256` text
- `imported_at` timestamptz

Unique:

```text
(provider_id, version, checksum_sha256)
```

### `provinces`

- `id` UUID primary key
- `provider_id` FK
- `source_key` text
- `code` text, normalized two-digit Turkish province code
- `name` text
- `active` boolean
- timestamps

Unique:

```text
(provider_id, source_key)
```

Only one active province may own a given province code.

Index:

```text
(active, code, name)
```

### `districts`

- `id` UUID primary key
- `provider_id` FK
- `source_key` text
- `province_id` FK -> `provinces.id`
- `name` text
- `active` boolean
- timestamps

Unique:

```text
(provider_id, source_key)
```

Index:

```text
(province_id, active, name)
```

### `neighborhoods`

- `id` UUID primary key
- `provider_id` FK
- `source_key` text
- `district_id` FK -> `districts.id`
- `name` text
- `kind` text nullable
- `active` boolean
- timestamps

Unique:

```text
(provider_id, source_key)
```

Index:

```text
(district_id, active, name)
```

## Identity and stability

Application IDs are independent UUIDs. Imported entities are matched by:

```text
(provider_id, source_key)
```

Display names are never identity.

This allows:

- spelling/name changes without new rows
- duplicate names under different parents
- stable historical listing references
- reactivation of previously removed source entities with the same ID

Provider identity is separate from snapshot/import identity, so a newer provider version updates the same logical rows.

## Normalized snapshot contract

The importer accepts:

```ts
interface NormalizedLocationSnapshot {
  provider: {
    code: string
    sourceName: string
    sourceUrl?: string
    license?: string
    version: string
  }
  provinces: Array<{
    sourceKey: string
    code: string
    name: string
  }>
  districts: Array<{
    sourceKey: string
    provinceSourceKey: string
    name: string
  }>
  neighborhoods: Array<{
    sourceKey: string
    districtSourceKey: string
    name: string
    kind?: string
  }>
}
```

The importer validates before opening a write transaction.

Validation rejects:

- missing provider metadata
- empty hierarchy levels
- duplicate source keys
- duplicate province codes
- empty/whitespace names
- orphan districts
- orphan neighborhoods

A deterministic SHA-256 checksum is computed from a trimmed, source-key-sorted canonical representation. Runtime timestamps are not included.

## Import behavior

Command:

```bash
pnpm reference:import:locations -- <normalized-snapshot.json>
```

Development/CI fixture:

```text
data/reference/locations/fixture.locations.json
```

Pinned operational source metadata:

```text
data/reference/locations/source-manifest.json
```

Import algorithm:

1. Load normalized snapshot JSON.
2. Validate the full hierarchy.
3. Compute deterministic SHA-256 checksum.
4. Start one PostgreSQL transaction.
5. Insert/update stable provider by provider `code`.
6. If switching operational provider, deactivate active rows belonging to the previous provider; retain them for history.
7. Insert/find import metadata by `(provider_id, version, checksum)`.
8. Upsert provinces by `(provider_id, source_key)`.
9. Upsert districts by `(provider_id, source_key)` and resolve parent IDs from source keys.
10. Upsert neighborhoods by `(provider_id, source_key)` and resolve parent IDs from source keys.
11. Reactivate rows present in the new snapshot.
12. Deactivate current-provider rows absent from the new snapshot, child-to-parent.
13. Commit.

Validation failure happens before the transaction. Persistence failure rolls the transaction back. Existing working reference data remains usable.

Re-importing the same provider/version/checksum must not duplicate entities or import metadata.

## Why deactivate instead of delete

A listing may reference a location that is later renamed, merged, or removed. Hard deletion could invalidate old listings.

Inactive rows:

- remain available for historical foreign keys
- are omitted from new listing/filter choices
- may be reactivated with the same application ID if the source entity returns

## API

All endpoints are public and read-only for MVP.

### `GET /api/v1/reference/provinces`

Returns active provinces sorted by code, then name.

```json
{
  "items": [
    { "id": "uuid", "code": "34", "name": "İstanbul" }
  ]
}
```

### `GET /api/v1/reference/provinces/:provinceId/districts`

Returns active districts for an active province, alphabetically.

Unknown or inactive parent: HTTP 404 with `REFERENCE_PARENT_NOT_FOUND`.

### `GET /api/v1/reference/districts/:districtId/neighborhoods`

Returns active neighborhoods for an active district, alphabetically.

Unknown or inactive parent: HTTP 404 with `REFERENCE_PARENT_NOT_FOUND`.

Public responses do not include provider IDs, source keys, source URLs, versions, or checksums.

## Contracts and module boundaries

Public response schemas live in `packages/contracts/src/reference.ts`.

API code follows existing boundaries:

```text
route
  -> LocationService
  -> LocationRepository
  -> PostgreSQL
```

Import infrastructure remains separate:

```text
reference/import/
  location-import.types.ts
  location-validator.ts
  location-checksum.ts
  location-importer.ts
  import-cli.ts
```

Listing modules must consume reference IDs/API contracts rather than know provider-specific source formats.

## Testing

### Unit

- valid snapshot accepted
- duplicate source keys rejected
- duplicate province codes rejected
- orphan district/neighborhood rejected
- missing metadata/names rejected
- checksum is independent of array insertion order

### PostgreSQL 18 integration

- migration creates provider/import/location tables
- parent foreign keys are enforced
- first import creates hierarchy
- repeated import is idempotent
- renamed entity preserves ID
- missing entity becomes inactive
- reintroduced entity preserves ID and reactivates
- invalid snapshot leaves existing data unchanged

### API integration

- only active rows returned
- deterministic ordering
- child queries scoped to parent
- unknown parent returns 404
- inactive parent returns 404
- source/provider metadata is not exposed

CI additionally runs the same root fixture-import CLI documented for developers.

## Performance and scalability

This dataset is small compared with listings. PostgreSQL indexes are sufficient.

Do not add Redis/cache/search infrastructure for this phase. If measured traffic later justifies caching, it can be introduced without changing the public API or location data model.

## Operational update policy

- imports are deliberate maintenance operations
- API startup never imports
- deploy never downloads/imports a live snapshot implicitly
- source version/commit is reviewed before a production import
- each successful import records version/checksum provenance
- runtime keeps serving PostgreSQL if external upstream is unavailable

## Security and privacy

Only public administrative reference data belongs here.

Do not store:

- user addresses
- TC numbers
- listing-owner information
- EİDS verification data

inside this subsystem.

## Out of scope

- vehicle make/series/model data
- streets
- coordinates/polygons/GIS
- building/address-number UAVT data
- postal codes
- geocoding
- map search
- fuzzy location search
- automatic external synchronization
- reference-data admin UI

## Acceptance criteria

This phase is complete when:

1. PostgreSQL stores province/district/neighborhood data with stable provider identity and import provenance.
2. A normalized snapshot can be imported repeatedly without duplicates.
3. A newer snapshot updates the same logical rows by provider/source key.
4. Removed entities become inactive rather than being deleted.
5. Public read-only hierarchy endpoints work under `/api/v1/reference/*`.
6. Contracts are shared through `packages/contracts`.
7. PostgreSQL 18 integration tests verify migration/import/FK behavior.
8. CI verifies the explicit root import CLI plus lint, typecheck, tests, build, and frozen lockfile.
9. Normal runtime has zero external location-service dependency.
