# Bizzat — Technical Architecture Design

**Date:** 2026-09-07  
**Status:** Approved architecture design for implementation planning  
**Scope:** First MVP defined in `docs/MVP_SCOPE.md`

## 1. Goal

Build Bizzat as a system that is:

- easy for a frontend-oriented developer to understand end to end,
- cheap to operate at the beginning,
- self-hosted on a normal Linux VM/VDS,
- fast enough for the first production stages without premature infrastructure,
- structured so that database, API, storage, search, and background work can be separated later without rewriting the product.

The architecture deliberately chooses a **modular monolith**. Scalability means preserving clean extraction points, not running distributed infrastructure before measurements justify it.

## 2. Non-goals

The first architecture will not introduce:

- microservices,
- Kubernetes,
- Kafka or RabbitMQ,
- Redis,
- Elasticsearch/OpenSearch/Meilisearch,
- event sourcing,
- CQRS,
- a separate API gateway,
- read replicas,
- database partitioning,
- a managed database/auth/backend platform,
- a generic EAV metadata database.

These technologies are not rejected permanently. They require a measured production need before adoption.

## 3. Architecture summary

```text
Internet
   |
   | 80 / 443
   v
 Caddy
   |---------------------------|
   |                           |
   v                           v
Next.js web                 Fastify API
:3000                       :4000
                               |
                               v
                            Kysely
                               |
                               v
                         PostgreSQL 18
                            :5432

Persistent host volumes:
- PostgreSQL data
- listing image files

Off-site backup target:
- database dumps
- uploaded listing media
```

Only Caddy is exposed publicly. The API and PostgreSQL communicate on the Docker private network.

The cloud provider is treated as a replaceable Linux machine. AWS EC2, Azure VM, or another VDS provider can host the same Compose stack.

## 4. Technology decisions

| Area | Decision | Reason |
|---|---|---|
| Frontend | Next.js + TypeScript | Existing frontend familiarity, SSR/SEO, responsive web MVP |
| Backend | Fastify + TypeScript | Explicit request/route model, low framework magic, schema support, good modular boundaries |
| DB access | Kysely + `pg` | Type-safe SQL without hiding relational/query behavior behind a heavy ORM |
| Database | PostgreSQL 18 | Mature relational database, built-in FTS/GIN, partial indexes, native `uuidv7()` |
| Authentication | Better Auth, self-hosted | Avoid custom password/session security while keeping auth and data on our server/PostgreSQL |
| API style | REST under `/api/v1` | Explicit, debuggable, future mobile-friendly, low conceptual overhead |
| Validation/contracts | Fastify schema + TypeBox/shared contracts | Runtime validation and TypeScript types from one contract source |
| Image processing | `sharp` | Generate deterministic image variants on upload |
| Reverse proxy/TLS | Caddy | Simple automatic HTTPS and reverse proxy configuration |
| Process packaging | Docker Compose | Reproducible local/production runtime without an orchestrator |
| Monorepo | pnpm workspace | Shared TypeScript contracts/schema while keeping web and API separate applications |

Library minor versions are not architecture decisions. At implementation start, stable mutually compatible releases are selected and pinned by the lockfile. Beta/RC releases are excluded from the production baseline.

PostgreSQL 18 is a deliberate baseline because `uuidv7()` is available in core and the project benefits from time-ordered external-safe identifiers.

## 5. Repository layout

Target structure:

```text
bizzat/
  apps/
    web/
      src/
    api/
      src/
        modules/
        db/
        common/
  packages/
    contracts/
    listing-schema/
  infra/
    caddy/
    docker/
    backup/
  docker-compose.yml
  pnpm-workspace.yaml
```

Responsibilities:

- `apps/web`: pages, components, forms, server rendering, API client usage.
- `apps/api`: authentication integration, domain/business rules, persistence, external providers.
- `packages/contracts`: API request/response/error schemas shared by web and API.
- `packages/listing-schema`: machine-readable listing/filter field definitions for supported listing types.
- `infra`: deployment configuration only; no product/domain code.

## 6. Backend module model

The API remains one deployable process but is divided by business capability.

Initial modules:

```text
modules/
  auth/
  users/
  listings/
  categories/
  locations/
  vehicles/
  verification/
  moderation/
  media/
```

Typical module:

```text
modules/listings/
  listing.routes.ts
  listing.service.ts
  listing.repository.ts
  listing.errors.ts
```

Dependency flow:

```text
route
  -> validation + authentication
service
  -> business rules + transaction boundaries
repository
  -> SQL / Kysely
PostgreSQL
```

Rules:

1. Routes do not contain SQL.
2. Repositories do not decide product/business policy.
3. Services own authorization decisions and state transitions.
4. A module does not reach into another module's repository. It calls the other module's service/public interface.
5. No dependency-injection framework is required. Plain TypeScript composition is preferred until complexity proves otherwise.
6. Files should stay focused; modules are split by clear responsibility rather than arbitrary technical layers.

## 7. API contract strategy

REST is the public application API.

Examples:

```text
GET    /api/v1/listings
POST   /api/v1/listings
GET    /api/v1/listings/:id
PATCH  /api/v1/listings/:id
POST   /api/v1/listings/:id/publish
POST   /api/v1/verifications
POST   /api/v1/listings/:id/reports
GET    /api/v1/me/listings
```

Shared contract package:

```text
packages/contracts/
  listing.ts
  auth.ts
  verification.ts
  moderation.ts
  common.ts
```

The contract defines:

- request params,
- query params,
- request bodies,
- response bodies,
- error shapes.

`packages/listing-schema` is separate. It defines **what fields a listing type has and how UI/filter forms behave**; it is not the transport/API contract layer.

OpenAPI may be generated from route schemas later. A second manually maintained API specification is not introduced.

## 8. Error model

All API failures use one predictable shape:

```json
{
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "İlan bulunamadı.",
    "requestId": "..."
  }
}
```

Initial stable codes include:

```text
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
LISTING_NOT_FOUND
LISTING_NOT_EDITABLE
VERIFICATION_REQUIRED
VERIFICATION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

The web application branches on `code`, never by parsing human-readable `message`.

Unexpected exceptions are logged with request ID and converted to `INTERNAL_ERROR`; stack traces are not sent to clients in production.

## 9. Authentication

Authentication is self-hosted inside the Fastify API using Better Auth.

Principles:

- User/session records live in our PostgreSQL database.
- Better Auth owns its required auth tables/migrations; application profile/domain data remains separate.
- Browser authentication uses secure HttpOnly cookies.
- Do not implement password hashing or session token security manually.
- First roles: `user`, `moderator`, `admin`.
- Authorization remains application service logic; authentication library roles do not replace domain checks.

Recommended DB separation:

- Better Auth tables in PostgreSQL schema `auth`.
- Bizzat product tables in `public` initially.

This is organization inside one PostgreSQL database, not a separate database/service.

## 10. Listing data model

### 10.1 Core principle

Use a relational hybrid:

- common listing fields in `listings`,
- category-specific queryable fields in typed one-to-one detail tables,
- UI/filter definitions in code/schema metadata,
- JSONB only for genuinely unstructured metadata, not as the primary listing filter store.

Do not build a generic EAV `listing_attribute_values` engine.

### 10.2 Listing types

`listing_types` represents valid publishable product combinations.

Initial rows conceptually:

```text
apartment_sale
apartment_rent
car_sale
```

This prevents unsupported combinations from appearing merely because a generic category + transaction pair happens to exist.

### 10.3 Core tables

Conceptual core:

```text
profiles
categories
listing_types

cities
districts
neighborhoods

vehicle_makes
vehicle_series
vehicle_models

listings
apartment_details
car_details
listing_images

verification_checks
reports
moderation_actions
```

Better Auth tables are managed separately in schema `auth`.

### 10.4 `listings`

```text
id                    uuid primary key default uuidv7()
owner_user_id         uuid foreign key
listing_type_id       foreign key
title                 text
description           text
price_amount          numeric(16,2)
currency              char(3)
city_id               foreign key
district_id           foreign key
neighborhood_id       foreign key nullable
status                text
contact_phone_e164    text nullable
show_phone            boolean
published_at          timestamptz nullable
created_at            timestamptz
updated_at            timestamptz
```

Status model at minimum:

```text
draft
pending_verification
pending_review
published
rejected
inactive
```

State transitions are enforced by the listing service rather than allowing arbitrary status updates from the API.

### 10.5 `apartment_details`

One-to-one with `listings`.

Representative fields:

```text
listing_id            uuid primary key / foreign key
gross_m2              integer
net_m2                integer
room_count            text
building_age          text
floor                  text
floor_count            integer
heating_type           text
bathroom_count         integer
kitchen_type           text
has_balcony            boolean
has_elevator           boolean
parking_type           text
furnished              boolean
occupancy_status       text
in_site                boolean
title_deed_status      text
credit_eligible        boolean nullable
swap_available         boolean nullable
```

Exact fields/options must come from the approved Sahibinden reference and machine-readable schema work, not from this abbreviated table.

### 10.6 `car_details`

One-to-one with `listings`.

Representative fields:

```text
listing_id                 uuid primary key / foreign key
make_id                    foreign key
series_id                  foreign key
model_id                   foreign key
model_year                 smallint
mileage_km                 integer
fuel_type                  text
transmission               text
vehicle_condition          text
body_type                  text
engine_power_hp            smallint nullable
engine_displacement_cc     integer nullable
drivetrain                 text nullable
color                      text
under_warranty             boolean nullable
heavy_damage_recorded      boolean nullable
plate_nationality          text
swap_available             boolean nullable
paint_status               text nullable
replacement_status         text nullable
```

### 10.7 Enum-like values

Avoid creating a PostgreSQL ENUM for every product option.

Prefer:

- stable readable string codes in DB,
- shared allowed-value definitions in listing schema/contracts,
- DB `CHECK` constraints where the allowed set is truly stable and useful for integrity.

This avoids unnecessary database enum migrations for ordinary catalog changes.

## 11. Machine-readable listing schema

The frontend needs dynamic forms and filters; the database does not need to become dynamically typed.

```text
packages/listing-schema/
  apartment-sale.ts
  apartment-rent.ts
  car-sale.ts
```

Each field definition can describe:

```text
key
type
label
required
filterable
sortable
options
min/max/unit
UI grouping
```

Both API validation and frontend form/filter generation should reuse these definitions where practical.

Important distinction:

> Dynamic UI schema does not imply dynamic EAV storage.

Adding a major new category may require:

1. listing schema definition,
2. migration/new typed detail table or extension,
3. repository query support,
4. UI route/category exposure.

That explicit work is accepted in exchange for simpler SQL and operational clarity.

## 12. IDs and timestamps

Application/domain primary keys use PostgreSQL UUID with `uuidv7()` default where appropriate.

Reasons:

- safe to expose publicly compared with sequential numeric IDs,
- naturally sortable/time-ordered,
- better index locality than purely random UUIDv4 for insert-heavy tables.

`created_at` and `updated_at` are still explicit columns. Business logic must not depend on decoding creation time from a UUID.

## 13. Search and filtering

Initial listing search stays in PostgreSQL.

Capabilities:

- B-tree indexes for equality/range/sorting,
- partial indexes for published-only search paths,
- PostgreSQL full-text search for title/description keyword search,
- GIN index for full-text search vector if/when keyword search is enabled.

No external search engine is introduced initially.

External search becomes an option only when production measurements show PostgreSQL search cannot meet latency/load requirements or when product requirements need features PostgreSQL FTS cannot reasonably provide.

## 14. Initial index strategy

Indexes are intentional, not automatic on every filter field.

Initial candidates:

```text
listings:
  (owner_user_id, status, updated_at desc)
  (listing_type_id, published_at desc)
    WHERE status = 'published'
  (listing_type_id, city_id, district_id, price_amount)
    WHERE status = 'published'

apartment_details:
  room_count
  gross_m2

car_details:
  (make_id, series_id, model_id)
  model_year
  mileage_km

listing_images:
  (listing_id, sort_order)

reports:
  (status, created_at)
```

Additional indexes require evidence from real query shapes and `EXPLAIN (ANALYZE, BUFFERS)`.

The index list above is a starting hypothesis, not permission to index every field listed in the UI.

## 15. Media storage

Use a small internal storage abstraction:

```text
Storage
  put()
  delete()
  url()
```

First provider: local filesystem on persistent host volume.

Directory/key convention:

```text
listings/{listingId}/{imageId}/original.webp
listings/{listingId}/{imageId}/thumb.webp
listings/{listingId}/{imageId}/card.webp
```

The API validates the upload and `sharp` produces required variants.

`listing_images` stores metadata and storage keys, not image binary data.

Representative metadata:

```text
id
listing_id
storage_key
sort_order
width
height
mime_type
size_bytes
created_at
```

When multiple API machines become necessary, replace `LocalDiskStorage` with an S3-compatible provider and optionally a CDN. Listing/domain code must not depend on the concrete storage backend.

## 16. EİDS verification boundary

EİDS is a production publish gate, but the exact provider/protocol is an external integration dependency.

Define a provider boundary from day one:

```text
VerificationProvider
  verifyPropertyAuthority(...)
  verifyVehicleAuthority(...)
```

Environments:

- local/test: explicit mock provider allowed,
- production: real approved provider required,
- production failure/unavailability: fail closed; do not silently publish.

Do not persist raw provider responses unless a concrete operational/legal need is identified.

Persist only the minimum verification state needed for audit/product behavior, for example:

```text
verification_checks
  id
  listing_id
  type
  provider
  status
  provider_reference nullable
  failure_code nullable
  verified_at nullable
  created_at
```

TC identity number, plate, property number, and relationship data are treated as sensitive. Logging/redaction and retention are defined before production EİDS activation.

## 17. Transaction rules

Transactions belong to services and cover only operations that must succeed or fail atomically.

Example listing creation transaction:

```text
BEGIN
  insert listings
  insert apartment_details/car_details
  insert listing image metadata as appropriate
COMMIT
```

External HTTP calls do **not** run inside an open database transaction.

EİDS pattern:

```text
DB transaction:
  create/update verification = pending
COMMIT

call EİDS

DB transaction:
  persist verification result
  perform allowed listing status transition
COMMIT
```

This avoids holding database connections/locks while waiting on an external service.

If asynchronous/retryable verification later becomes necessary, the same provider/service boundary can be moved to a worker/queue without redesigning listing storage.

## 18. Single-VM production topology

Docker Compose services:

```text
caddy
web
api
postgres
backup
```

No Redis/worker container initially.

Network rules:

- public firewall: 80/443 and restricted SSH only,
- Caddy is the only public application entry point,
- Fastify is reachable only on Compose private network,
- PostgreSQL is reachable only on Compose private network,
- database port is not published to the internet.

Recommended origin layout:

```text
https://bizzat.tr/          -> Next.js
https://bizzat.tr/api/*     -> Fastify
https://bizzat.tr/media/*   -> listing media delivery strategy
```

Same-origin web/API simplifies cookies and avoids unnecessary CORS exposure.

## 19. Deployment

Do not deploy with ad-hoc `git pull && npm install` on production.

Target flow:

```text
main branch
  -> CI validates/builds
  -> Docker images produced
  -> VM pulls approved images
  -> controlled migrations
  -> docker compose up -d targeted services
```

Database is persistent and is not recreated on ordinary app deploys.

First-stage availability target accepts short deployment interruption rather than introducing a load balancer/orchestrator only for zero-downtime releases.

Migration rules:

- migrations are version-controlled,
- migrations run explicitly before compatible app release,
- destructive migrations use expand/migrate/contract style when data volume or deployment compatibility requires it,
- no automatic schema mutation at app startup in production.

## 20. Backup and recovery

A Docker volume on the same VM is persistence, **not backup**.

Initial backup baseline:

- scheduled PostgreSQL logical dump,
- scheduled backup/sync of uploaded media,
- copy to an off-site target physically/provider-separated from the VM,
- retention policy with multiple generations,
- periodic restore test.

When recovery requirements become stricter, upgrade database strategy to WAL archiving/PITR. Do not operate PITR infrastructure before the product needs the recovery objective.

Backup secrets and destination credentials are kept outside git.

## 21. Security baseline

Production minimum:

- HTTPS via Caddy,
- SSH key authentication; no password SSH,
- firewall with only required ports,
- PostgreSQL not public,
- secrets outside repository,
- HttpOnly/Secure auth cookies,
- API input validation at boundaries,
- upload file type/size validation,
- request IDs and safe structured logs,
- sensitive value redaction,
- least-privilege application DB credentials practical for the first deployment,
- dependency update process,
- off-site backup.

The design does not claim this list replaces a production security review, KVKK review, or EİDS-specific legal/technical requirements.

## 22. Observability

Start small:

- structured Fastify logs,
- request ID propagated through web/API logs where practical,
- Docker/container health checks,
- `/health` and DB-aware readiness endpoint,
- VM CPU/RAM/disk monitoring,
- PostgreSQL slow-query visibility/logging with conservative thresholds.

Do not deploy Prometheus/Grafana/ELK solely to satisfy an architecture checklist.

Add richer observability when operating the service manually becomes difficult or production incident diagnosis proves insufficient.

## 23. Testing strategy

### Unit tests

Use Vitest for service-level business rules where isolated tests provide value.

Examples:

- listing state transitions,
- ownership/authorization rules,
- verification gate rules,
- schema mapping helpers.

Do not mock every internal function merely to obtain coverage.

### Integration tests

Use a real PostgreSQL test database/container for:

- Kysely repositories,
- migrations,
- Fastify route + DB behavior,
- transaction rollback behavior,
- filtering/query correctness.

SQL behavior is not considered proven by repository mocks.

### E2E tests

Use Playwright for a small number of user-visible critical journeys:

1. browse/filter listings,
2. open listing detail,
3. register/login,
4. create apartment/car listing using test verification provider,
5. edit/deactivate own listing,
6. report listing,
7. moderator removes reported listing.

E2E tests assert visible product behavior, not component implementation details.

### Pull request CI

Minimum:

```text
lint
typecheck
unit tests
integration tests with PostgreSQL
web build
api build
critical E2E set when practical
```

A giant E2E suite is explicitly not a first-stage goal.

## 24. Scalability path

Scale only after measurement.

### Stage 1 — initial

One VM:

```text
Caddy + web + API + PostgreSQL + media + backup job
```

Vertical scaling is allowed and expected before distributed infrastructure.

### Stage 2 — database pressure or reliability need

Move PostgreSQL to a dedicated VM while leaving app architecture unchanged.

Trigger examples:

- DB memory/IO competes materially with app workloads,
- backup/recovery requirements justify isolation,
- vertical VM scaling becomes inefficient.

### Stage 3 — API CPU/concurrency pressure

Run multiple stateless API instances behind a load balancer/reverse proxy.

Prerequisites already preserved:

- auth/session state in PostgreSQL,
- domain data in PostgreSQL,
- API code does not depend on process-local durable state.

At this point local media storage must be moved to shared/object storage if multiple app hosts serve uploads.

### Stage 4 — media pressure

Move media to S3-compatible object storage and optionally CDN.

The storage abstraction is the extraction seam.

### Stage 5 — background jobs

Introduce a worker and queue only when there are real asynchronous workloads such as:

- expensive image processing,
- notification fan-out,
- retryable EİDS workflows,
- scheduled cleanup/imports that should not run in API request lifecycle.

Redis/queue technology is selected then based on actual job semantics.

### Stage 6 — search pressure

Consider external search only when query measurements/product requirements justify it.

The listing search repository/service is the extraction seam.

### Stage 7 — service extraction

A module may become a separate service only when it has a concrete operational reason, such as:

- independent scaling profile,
- independent failure/retry needs,
- separate team ownership,
- security/network isolation requirement.

The first likely candidate is external verification/background processing, not the core listing CRUD path.

## 25. Explicitly rejected alternatives

### Next.js-only backend

Rejected as the primary architecture because Bizzat is expected to gain a reusable API surface for verification, moderation, possible mobile clients, and background workflows. Keeping a dedicated Fastify API gives a clearer mental model and extraction boundary with limited extra infrastructure because it runs on the same VM.

### NestJS

Rejected for the first version because its module/provider/decorator/guard/interceptor/DI model adds framework concepts that are not necessary for this small backend team. Fastify plus explicit module composition is easier to trace for a frontend-oriented developer.

### Express

Not chosen because Fastify gives stronger schema/validation/plugin primitives while remaining explicit and small.

### Prisma-heavy ORM model

Not chosen because the team wants SQL/query behavior to remain visible and understandable. Kysely provides type safety without replacing the SQL mental model.

### Supabase/Vercel-managed backend

Not chosen due to cost predictability and learning/operational preference. Standard PostgreSQL and Docker retain provider portability.

### Generic EAV

Rejected because high-cardinality/filter-heavy listing queries become complex, hard to index, and hard to debug. New category migrations are accepted as the simpler tradeoff.

### Everything in JSONB

Rejected because the primary product is filter/range/sort heavy. Typed relational columns remain the main query surface; JSONB is reserved for genuinely flexible metadata.

### Microservices/Kubernetes

Rejected because they add deployment, networking, observability, failure-mode, and local-development cost without a present scaling/team need.

## 26. Known external dependencies that do not block architecture

The following remain product/integration inputs rather than architecture ambiguity:

1. Exact EİDS access/application/protocol details.
   - Architecture decision is fixed: adapter boundary, production fail-closed, mock only in local/test.
2. Vehicle make/series/model source and license.
   - Architecture decision is fixed: normalized reference tables + importer/seed path.
3. Turkey city/district/neighborhood source.
   - Architecture decision is fixed: normalized location reference tables + importer/seed path.
4. Exact production VM provider and size.
   - Architecture decision is fixed: portable Docker Compose Linux deployment.
5. Final domain/brand operational setup.
   - Does not alter application architecture.

## 27. Implementation order implied by this design

The implementation plan should sequence work roughly as:

1. monorepo/tooling skeleton,
2. local Docker PostgreSQL and migration foundation,
3. API bootstrap + health/error/contracts,
4. Better Auth integration,
5. core reference tables and listing schema package,
6. listing relational schema + repositories,
7. browse/list/filter/detail API,
8. listing creation/state transitions,
9. verification provider interface + test/mock implementation,
10. media storage abstraction/local provider/image processing,
11. moderation/reporting,
12. Next.js user journeys,
13. production Compose/Caddy/backup configuration,
14. CI and critical test suite.

The implementation plan may split these into smaller reviewable tasks but must not silently introduce architecture components rejected by this design.

## 28. Architecture guardrails for future agents

Before adding a new infrastructure component, answer all three:

1. What measured/current problem does it solve?
2. Why can the existing simpler component not solve it acceptably?
3. What operational burden does the new component add?

If the answers are speculative, do not add it.

Before making a shortcut that collapses boundaries, answer:

1. Does it put SQL in routes/UI?
2. Does it make domain rules depend directly on infrastructure/provider SDKs?
3. Does it make future mobile/API/storage/verification extraction require a rewrite?

If yes, keep the existing boundary even if the first implementation is slightly more verbose.

## 29. Primary references checked for technology feasibility

- PostgreSQL 18 documentation and release notes: https://www.postgresql.org/docs/18/
- Better Auth PostgreSQL adapter: https://better-auth.com/docs/adapters/postgresql
- Better Auth Fastify integration: https://better-auth.com/docs/integrations/fastify
- Fastify documentation: https://fastify.dev/docs/latest/
- Kysely documentation: https://www.kysely.dev/docs/
- Next.js deployment/self-hosting documentation: https://nextjs.org/docs/app/getting-started/deploying
- Docker Compose production guidance: https://docs.docker.com/compose/how-tos/production/

## 30. Final decision

Bizzat will begin as a **self-hosted TypeScript modular monolith**:

```text
Next.js web
   -> REST contracts
Fastify API
   -> services/repositories
Kysely
   -> PostgreSQL 18
```

with:

- Better Auth in the API,
- category-specific relational detail tables,
- schema-driven forms/filters,
- local media storage behind an abstraction,
- EİDS behind a provider abstraction,
- Docker Compose + Caddy on one Linux VM,
- off-site backups,
- measured, staged scaling instead of speculative distributed infrastructure.

This design intentionally optimizes for **clarity first, operational simplicity second, and clean scaling exits third**.