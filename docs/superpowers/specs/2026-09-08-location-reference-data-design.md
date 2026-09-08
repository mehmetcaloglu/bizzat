# Location Reference Data Design

Date: 2026-09-08
Status: Approved in chat, awaiting written-spec review

## Goal

Provide Bizzat with stable, queryable Turkish location reference data for the MVP without making normal application traffic depend on an external address service.

The first implementation covers:

- provinces
- districts
- neighborhoods
- source/version metadata
- explicit import/update tooling
- read-only REST endpoints used by the web listing/search flows

Vehicle make/series/model reference data is intentionally a separate follow-up design and PR.

## Product boundary

This reference-data subsystem is supporting infrastructure, not a new product feature. It exists so listing creation and filtering can use normalized Turkish locations consistently.

It must not:

- call a third-party location API during ordinary page/API requests
- introduce Redis, queues, Elasticsearch, replicas, partitioning, or a new service
- silently replace current rows from an unversioned remote response
- treat a community dataset as an official government source
- couple listing domain logic to the import source format

## Source strategy

### Canonical public-sector reference

Turkey's official address/administrative truth is maintained through the national address system and related public-sector datasets. The implementation preserves that distinction in documentation and metadata.

### Import snapshot

For the initial implementation, Bizzat may consume a pinned, versioned, openly licensed snapshot whose maintainers state that it is aligned with current NVI/TUIK administrative data.

The imported dataset is an operational snapshot, not Bizzat's claim of being an official NVI mirror.

Every import records:

- provider/source code
- human-readable source name
- source version or release date
- source URL or repository URL
- license identifier when known
- checksum of the normalized import payload
- import timestamp

Changing source provider is allowed later without changing the public application API or listing schema.

## Runtime architecture

Normal runtime flow:

```text
Web -> Fastify /api/v1/reference/* -> PostgreSQL
```

Import/update flow:

```text
Pinned source snapshot -> normalizer -> validator -> PostgreSQL transaction
```

No external HTTP dependency exists in the read path.

## Data model

### `reference_data_sources`

Represents a stable provider/source, not an individual snapshot.

Fields:

- `id` UUID primary key
- `code` text unique, stable provider identifier
- `name` text
- `source_url` text nullable
- `license` text nullable
- `created_at` timestamptz

Example provider code: `turkey-geo-api`.

### `reference_data_imports`

Represents one imported source snapshot/release.

Fields:

- `id` UUID primary key
- `source_id` FK -> `reference_data_sources.id`
- `version` text
- `checksum_sha256` text
- `imported_at` timestamptz

Uniqueness:

- unique `(source_id, version, checksum_sha256)`

### `provinces`

Fields:

- `id` UUID primary key
- `source_id` FK -> `reference_data_sources.id`
- `source_key` text
- `code` text; Turkish province code, normalized as two digits
- `name` text
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Constraints/indexes:

- unique `(source_id, source_key)`
- unique `code`
- index `(active, code, name)`

### `districts`

Fields:

- `id` UUID primary key
- `source_id` FK -> `reference_data_sources.id`
- `source_key` text
- `province_id` FK -> `provinces.id`
- `name` text
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Constraints/indexes:

- unique `(source_id, source_key)`
- index `(province_id, active, name)`

### `neighborhoods`

Fields:

- `id` UUID primary key
- `source_id` FK -> `reference_data_sources.id`
- `source_key` text
- `district_id` FK -> `districts.id`
- `name` text
- `kind` text nullable; preserves source distinction such as mahalle/koy when present without forcing the UI to expose it
- `active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

Constraints/indexes:

- unique `(source_id, source_key)`
- index `(district_id, active, name)`

## Identity and stability

Application IDs are independent UUIDs. Import rows are matched by stable provider + source key, never by display names alone and never by snapshot/import ID.

Reason:

- Turkish administrative names can change
- duplicate names can exist under different parents
- punctuation/casing changes should not create duplicate entities
- a new snapshot version must update the same logical entity rather than insert a second copy

If the chosen initial source lacks a trustworthy stable key at one level, the normalizer must construct a deterministic provider-scoped key from stable parent identifiers plus the provider's raw identifier. A plain normalized display name by itself is not sufficient.

## Import behavior

The root command is:

```text
pnpm reference:locations:import -- <snapshot-path>
```

The initial repository snapshot path is:

```text
data/reference/locations/turkey-locations.json
```

Import algorithm:

1. Load the pinned snapshot.
2. Normalize source-specific fields into Bizzat's internal import DTO.
3. Validate the complete hierarchy before mutating the database.
4. Compute SHA-256 over the normalized payload.
5. Start one PostgreSQL transaction.
6. Insert/find the stable `reference_data_sources` provider record by `code`.
7. Insert/find the `reference_data_imports` snapshot record.
8. Upsert provinces by `(source_id, source_key)`.
9. Upsert districts by `(source_id, source_key)` and resolve province foreign keys.
10. Upsert neighborhoods by `(source_id, source_key)` and resolve district foreign keys.
11. Mark rows for the same provider that are absent from the new snapshot as `active = false` instead of deleting them.
12. Commit.

If validation or persistence fails, the transaction rolls back. The previously imported reference data remains usable.

Re-importing the same provider/version/checksum is a no-op from the application's point of view and must not create duplicate entities or duplicate import metadata.

## Why deactivate instead of delete

Listings may eventually reference a location that has been renamed, merged, split, or removed. Hard deletion would break historical referential integrity.

Inactive rows:

- remain resolvable for old listings
- are not returned by default in new listing/filter selection
- can be explicitly included by internal tooling later if needed

## Validation rules

Before a snapshot may be committed:

- provider code and source metadata are present
- province source keys are unique
- there are exactly 81 active provinces in the initial Turkey snapshot
- province codes are unique and are two-digit strings from `01` through valid Turkish plate codes
- district source keys are unique
- every district references an existing province
- neighborhood source keys are unique
- every neighborhood references an existing district
- names are non-empty after trimming
- district and neighborhood counts exceed minimum sanity thresholds derived from the inspected pinned snapshot

The exact district/neighborhood minimum thresholds are recorded alongside the pinned snapshot manifest during implementation. The importer fails closed on malformed or suspiciously incomplete snapshots.

## API

All endpoints are read-only and public for MVP.

### `GET /api/v1/reference/provinces`

Returns active provinces sorted by province code.

Response shape:

```json
{
  "items": [
    { "id": "uuid", "code": "34", "name": "İstanbul" }
  ]
}
```

### `GET /api/v1/reference/provinces/:provinceId/districts`

Returns active districts belonging to the active province, alphabetically by Turkish display name.

Unknown or inactive province: `404`.

### `GET /api/v1/reference/districts/:districtId/neighborhoods`

Returns active neighborhoods belonging to the active district, alphabetically by Turkish display name.

Unknown or inactive district: `404`.

No generic arbitrary search endpoint is added in this phase.

## Contracts

Public response schemas live in `packages/contracts` and are reused by Fastify and Next.js.

The importer DTO is internal to the API package because source normalization is infrastructure detail, not a public contract.

## Repository structure

Expected implementation areas:

```text
apps/api/src/reference/
  location.repository.ts
  location.service.ts
  location.routes.ts
  import/
    location-import.types.ts
    location-normalizer.ts
    location-validator.ts
    location-importer.ts
    import-cli.ts

apps/api/src/db/domain-migrations/
  0003_create_location_reference_tables.ts

packages/contracts/src/
  reference.ts

data/reference/locations/
  turkey-locations.json
  manifest.json
```

The default implementation stores a pinned normalized snapshot in the repository so local development and CI are deterministic and offline. Before committing the dataset, implementation must verify that its license permits redistribution and that its size is reasonable for the repository.

If either condition fails, stop and revise this design before substituting a live-download runtime dependency.

## Testing

### Unit tests

- source normalizer maps raw source data correctly
- validator rejects duplicate/orphan/empty records
- validator rejects snapshots without 81 provinces
- checksum generation is deterministic

### PostgreSQL integration tests

Run against real PostgreSQL 18:

- migration creates all tables/constraints
- first import inserts hierarchy
- importing the same snapshot is idempotent
- a newer snapshot from the same provider updates existing source-key rows instead of duplicating them
- changed names update existing rows
- missing rows become inactive
- failure mid-import rolls back the transaction
- parent foreign keys are enforced
- provider and import provenance records are preserved

### API tests

- province list returns only active rows
- district endpoint scopes to province
- neighborhood endpoint scopes to district
- inactive/unknown parent returns 404
- ordering is deterministic

No repository mock may substitute for the PostgreSQL integration coverage.

## Performance and scalability

The location dataset is small relative to listing data. PostgreSQL indexes on parent IDs and active/name ordering are sufficient.

Do not add caching infrastructure in this phase. If later metrics show this traffic is material, HTTP/application caching can be considered without changing the database model or API.

## Operational update policy

Location updates are deliberate maintenance operations, not automatic startup work.

Rules:

- API startup never runs location imports.
- Deploy does not fetch a live location dataset implicitly.
- A new snapshot/source version is reviewed and imported explicitly.
- Each successful import leaves provider/version/checksum provenance metadata.
- Import failure never deactivates the existing working dataset.

## Security and privacy

This subsystem contains public administrative reference data only. It must not contain user addresses, TC numbers, listing-owner information, or EİDS verification data.

## Out of scope

- vehicle make/series/model data
- coordinates, polygons, GIS boundaries
- address-number/building-level UAVT data
- postal codes
- geocoding
- map search
- fuzzy location search
- automatic external synchronization
- admin UI for reference data

## Acceptance criteria

This phase is complete when:

1. PostgreSQL stores normalized province/district/neighborhood reference data with stable provider identity and import provenance.
2. A pinned snapshot can be imported repeatedly without duplicate entities or import records.
3. A newer snapshot from the same provider updates the same logical rows.
4. Removed source entities become inactive rather than being deleted.
5. Public read-only hierarchy endpoints work through `/api/v1/reference/*`.
6. Contracts are shared with the web package.
7. Real PostgreSQL integration tests verify migration/import behavior.
8. CI passes frozen install, migrations, lint, typecheck, tests, and build.
9. Normal application runtime has zero dependency on an external location API.
