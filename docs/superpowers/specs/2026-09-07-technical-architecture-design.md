# Bizzat — Technical Architecture Design

**Date:** 2026-09-07  
**Status:** Draft for user review  
**Scope:** First MVP defined in `docs/MVP_SCOPE.md`

## 1. Goal

Build Bizzat as a system that is:

- easy for a frontend-oriented developer to understand end to end,
- cheap to operate initially,
- self-hosted on a normal Linux VM/VDS,
- fast enough for early production without premature infrastructure,
- structured so DB, API, storage, search, and background work can be separated later without rewriting the product.

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

These are not banned forever. Each requires a measured product/operational problem before adoption.

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
- private listing media
- public processed listing media

Off-site backup target:
- database dumps
- uploaded listing media
```

Only Caddy is public. Fastify and PostgreSQL are reachable only over the Docker private network.

The cloud provider is treated as a replaceable Linux machine. AWS EC2, Azure VM, or another VDS provider can host the same Compose stack.

## 4. Technology decisions

| Area | Decision | Reason |
|---|---|---|
| Frontend | Next.js + TypeScript | Frontend familiarity, SSR/SEO, responsive web MVP |
| Backend | Fastify + TypeScript | Explicit route model, low framework magic, schema support, modular boundaries |
| DB access | Kysely + `pg` | Type-safe SQL without hiding relational/query behavior |
| Database | PostgreSQL 18 | Mature relational DB, FTS/GIN, partial indexes, native `uuidv7()` |
| Authentication | Better Auth, self-hosted | Avoid custom password/session security while keeping data on our infrastructure |
| API style | REST under `/api/v1` | Explicit, debuggable, future mobile-friendly |
| Validation/contracts | Fastify schema + TypeBox/shared contracts | Runtime validation and TypeScript types from one source |
| Image processing | `sharp` | Deterministic optimized variants |
| Reverse proxy/TLS | Caddy | Simple HTTPS and reverse proxy configuration |
| Packaging | Docker Compose | Reproducible local/production runtime without an orchestrator |
| Monorepo | pnpm workspace | Shared TypeScript contracts/schema with separate web/API apps |

Library minor versions are not architecture decisions. At implementation start, stable mutually compatible releases are selected and pinned by the lockfile. Beta/RC releases are excluded from the production baseline.

PostgreSQL 18 is deliberate because `uuidv7()` is available in core.

## 5. Repository layout

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

- `apps/web`: pages, components, forms, SSR, API client usage.
- `apps/api`: auth integration, domain rules, persistence, external providers.
- `packages/contracts`: API request/response/error schemas shared by web and API.
- `packages/listing-schema`: machine-readable listing/filter field definitions.
- `infra`: deployment configuration only; no domain code.

## 6. Backend module model

One deployable API process, separated by business capability:

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
4. Modules do not reach into another module's repository; they use that module's service/public interface.
5. No dependency-injection framework initially. Plain TypeScript composition is preferred.
6. Split files/modules by responsibility, not ceremonial layers.

## 7. API contracts

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

Shared package:

```text
packages/contracts/
  listing.ts
  auth.ts
  verification.ts
  moderation.ts
  common.ts
```

Contracts define params, query, request body, response body, and errors.

`packages/listing-schema` is separate: it defines **what fields a listing type has and how forms/filters behave**, not the transport contract.

OpenAPI may later be generated from route schemas. Do not maintain a second handwritten API spec.

## 8. Error model

All API failures use one shape:

```json
{
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "İlan bulunamadı.",
    "requestId": "..."
  }
}
```

Initial stable codes:

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

The web branches on `code`, never by parsing the human-readable message.

Unexpected exceptions are logged with request ID and converted to `INTERNAL_ERROR`; production responses do not expose stack traces.

## 9. Authentication

Authentication is self-hosted inside the Fastify API using Better Auth.

Decisions:

- auth/session records live in our PostgreSQL database,
- Better Auth manages its auth schema/migrations,
- browser auth uses HttpOnly + Secure cookies in production,
- password hashing/session token security is not implemented manually,
- initial roles: `user`, `moderator`, `admin`,
- domain authorization still belongs to services.

Database organization:

- Better Auth tables in PostgreSQL schema `auth`,
- Bizzat product tables in `public` initially,
- one PostgreSQL database/service, not two databases.

### 9.1 User ID compatibility

Better Auth supports UUID ID generation for PostgreSQL. Configure its database ID strategy to UUID so application references and auth IDs use a compatible UUID type.

The implementation must verify the generated Better Auth migration before adding application foreign keys.

`listings.owner_user_id` and similar application references use the auth user UUID. Do not assume Better Auth's default base62/string ID strategy.

## 10. Listing data model

### 10.1 Core principle

Use a relational hybrid:

- common listing fields in `listings`,
- category-specific queryable fields in typed one-to-one detail tables,
- UI/filter definitions in code/schema metadata,
- JSONB only for genuinely unstructured metadata.

Do **not** build generic EAV storage and do not put the main filter surface into JSONB.

### 10.2 Listing types

`listing_types` represents valid publishable combinations.

Initial codes:

```text
apartment_sale
apartment_rent
car_sale
```

This prevents unsupported category/transaction combinations from existing accidentally.

### 10.3 Core tables

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

Better Auth tables live separately in schema `auth`.

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

Minimum status model:

```text
draft
pending_verification
pending_review
published
rejected
inactive
```

Clients never directly set arbitrary states. Listing service enforces allowed transitions.

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

Exact fields/options come from `docs/reference/SAHIBINDEN_REFERENCE.md` and the machine-readable schema work.

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

Avoid PostgreSQL ENUM for every product option.

Prefer:

- stable readable string codes in DB,
- shared allowed-value definitions in listing schema/contracts,
- DB `CHECK` constraints only where the set is genuinely stable/useful.

This keeps ordinary catalog changes from becoming awkward enum migrations.

## 11. Machine-readable listing schema

Dynamic forms do not require dynamically typed storage.

```text
packages/listing-schema/
  apartment-sale.ts
  apartment-rent.ts
  car-sale.ts
```

A field can describe:

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

Web form/filter generation and API validation reuse these definitions where practical.

> Dynamic UI schema does not imply EAV storage.

Adding a major category may require a schema definition, DB migration/detail table, repository query support, and UI exposure. That explicit work is accepted for simpler SQL/debugging.

## 12. IDs and timestamps

Application/domain primary keys use PostgreSQL UUID with `uuidv7()` default where appropriate.

Reasons:

- safe to expose publicly versus sequential IDs,
- time ordered,
- better index locality than purely random UUIDv4 for insert-heavy tables.

`created_at` and `updated_at` remain explicit. Business logic does not decode creation time from UUIDs.

Auth IDs are UUID-compatible via Better Auth configuration, but Better Auth owns generation/schema details for its tables.

## 13. Search and filtering

Initial search stays in PostgreSQL:

- B-tree indexes for equality/range/sort,
- partial indexes for published-only paths,
- PostgreSQL full-text search for title/description keyword search,
- GIN index for the FTS vector when keyword search is enabled.

No external search engine initially.

External search is considered only when measured query load/latency or required search features exceed what PostgreSQL can reasonably provide.

## 14. Initial index strategy

Start intentionally, not with an index on every filter field.

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

This is a starting hypothesis. Add/change indexes from actual query shapes and `EXPLAIN (ANALYZE, BUFFERS)` evidence.

## 15. Media storage

Internal abstraction:

```text
Storage
  put()
  delete()
  url()
```

First provider: local filesystem on persistent host volumes.

Image processing uses `sharp` to produce variants such as:

```text
listings/{listingId}/{imageId}/original.webp
listings/{listingId}/{imageId}/thumb.webp
listings/{listingId}/{imageId}/card.webp
```

`listing_images` stores metadata/storage keys, never image binary.

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

### 15.1 Private draft vs public media

Do not expose the raw upload/private storage volume directly through Caddy.

Initial local-storage rule:

- draft/unpublished media is stored in a private media root and fetched only through an authenticated/authorized API path,
- processed media for a published listing may be promoted/copied/moved to a public media root mounted read-only into Caddy,
- deleting/deactivating a listing follows explicit media lifecycle rules; public URLs are never treated as the source of truth,
- storage keys remain provider-neutral.

This avoids treating an unguessable filename as authorization.

When multiple API machines become necessary, replace local storage with S3-compatible object storage and optionally a CDN. Domain/listing code stays unchanged.

## 16. EİDS verification boundary

EİDS is a production publish gate. Exact provider/protocol details remain an external integration dependency.

Define:

```text
VerificationProvider
  verifyPropertyAuthority(...)
  verifyVehicleAuthority(...)
```

Environment behavior:

- local/test: explicit mock provider allowed,
- production: real approved provider required,
- production failure/unavailability: fail closed; never silently publish.

Do not persist raw provider responses unless a concrete legal/operational need exists.

Minimal persisted shape:

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

TC identity number, plate, property number, and relationship data are sensitive. Redaction/retention rules are finalized before production EİDS activation.

## 17. Transaction rules

Services own transaction boundaries. Transactions cover only DB operations that must be atomic.

Listing core creation example:

```text
BEGIN
  insert listings
  insert apartment_details/car_details
COMMIT
```

Media filesystem/object-storage writes are not part of a PostgreSQL transaction. Media service uses explicit ordering and compensation/cleanup:

1. validate/upload/process file,
2. persist metadata transactionally,
3. if DB persistence fails, clean up orphaned uploaded files,
4. periodic cleanup can remove stale orphan files if a process dies between steps.

External HTTP calls are never made inside an open DB transaction.

EİDS pattern:

```text
DB transaction:
  verification = pending
COMMIT

call EİDS

DB transaction:
  persist result
  perform allowed listing state transition
COMMIT
```

This avoids holding DB connections/locks while waiting on external services.

## 18. Single-VM production topology

Compose services:

```text
caddy
web
api
postgres
backup
```

No Redis/worker initially.

Network rules:

- public firewall: 80/443 and restricted SSH only,
- Caddy is the only public application entry point,
- Fastify private to Compose network,
- PostgreSQL private to Compose network,
- DB port not published publicly.

Origin layout:

```text
https://bizzat.tr/          -> Next.js
https://bizzat.tr/api/*     -> Fastify
https://bizzat.tr/media/*   -> only processed public listing media
```

Same-origin web/API simplifies cookies and avoids unnecessary CORS exposure.

## 19. Deployment

Do not use ad-hoc `git pull && npm install` as the production process.

Target:

```text
main
  -> CI validate/build
  -> Docker images
  -> VM pulls approved images
  -> controlled migrations
  -> docker compose up -d targeted services
```

PostgreSQL is persistent and is not recreated on ordinary app deploys.

Early production accepts a short deploy interruption instead of introducing load balancing/orchestration solely for zero downtime.

Migration rules:

- version controlled,
- explicit before compatible release,
- destructive changes use expand/migrate/contract when required by data volume/deployment compatibility,
- no automatic production schema mutation at API startup.

## 20. Backup and recovery

A same-VM Docker volume is persistence, not backup.

Initial baseline:

- scheduled PostgreSQL logical dumps,
- scheduled media backup/sync,
- off-site/provider-separated destination,
- multiple retained generations,
- periodic restore test.

When recovery objectives require it, upgrade DB backup to WAL archiving/PITR. Do not run PITR infrastructure before the product requires it.

## 21. Security baseline

Minimum production baseline:

- HTTPS via Caddy,
- SSH keys; no password SSH,
- firewall only required ports,
- PostgreSQL not public,
- secrets outside git,
- HttpOnly/Secure auth cookies,
- Better Auth CSRF/origin protections remain enabled,
- API input validation,
- upload type/size validation,
- request IDs + safe structured logs,
- sensitive-value redaction,
- least-privilege practical DB credentials,
- dependency update process,
- off-site backup.

This does not replace KVKK, EİDS, or production security review.

## 22. Observability

Start small:

- structured Fastify logs,
- request IDs,
- Docker/container health checks,
- `/health` and DB-aware readiness endpoint,
- VM CPU/RAM/disk monitoring,
- PostgreSQL slow-query visibility with conservative thresholds.

Do not deploy Prometheus/Grafana/ELK solely for architecture completeness. Add richer observability when manual operation/incident diagnosis proves insufficient.

## 23. Testing strategy

### Unit — Vitest

Focus on service business rules:

- listing state transitions,
- ownership/authorization,
- verification gate,
- schema mapping helpers.

Do not mock every internal function for coverage.

### Integration — real PostgreSQL

Test:

- Kysely repositories,
- migrations,
- Fastify route + DB behavior,
- rollback behavior,
- filtering/query correctness.

Repository mocks do not prove SQL behavior.

### E2E — Playwright

Keep a small critical set:

1. browse/filter listings,
2. listing detail,
3. register/login,
4. create apartment/car listing using test verification provider,
5. edit/deactivate own listing,
6. report listing,
7. moderator removes reported listing.

Assert user-visible behavior, not component internals.

### PR CI

```text
lint
typecheck
unit tests
integration tests + PostgreSQL
web build
api build
critical E2E set when practical
```

A huge E2E suite is not a first-stage goal.

## 24. Scalability path

Scale only after measurement.

### Stage 1 — one VM

```text
Caddy + web + API + PostgreSQL + media + backup job
```

Vertical scaling comes first.

### Stage 2 — DB pressure/reliability

Move PostgreSQL to a dedicated VM without changing application architecture.

Signals:

- DB memory/IO materially competes with app workloads,
- recovery/backup isolation becomes important,
- vertical scaling becomes inefficient.

### Stage 3 — API pressure

Run multiple stateless API instances behind reverse proxy/load balancer.

The design already keeps auth/session/domain state in PostgreSQL rather than process memory.

At this point local media must move to shared/object storage.

### Stage 4 — media pressure

Move to S3-compatible object storage and optionally CDN. `Storage` is the extraction seam.

### Stage 5 — background jobs

Introduce worker + queue only when real async workloads exist, for example:

- expensive image processing,
- notification fan-out,
- retryable EİDS workflows,
- scheduled heavy imports/cleanup.

Queue technology is selected from actual job semantics; Redis is not preselected now.

### Stage 6 — search pressure

Consider external search only when PostgreSQL search measurements or product requirements justify it. Listing search repository/service is the extraction seam.

### Stage 7 — service extraction

Extract a module only for a concrete operational reason:

- different scaling profile,
- different failure/retry behavior,
- separate team ownership,
- security/network isolation.

External verification/background processing is more likely to be extracted before core listing CRUD.

## 25. Explicitly rejected alternatives

### Next.js-only backend

Not selected because Bizzat is expected to have a reusable API surface for verification, moderation, possible mobile clients, and background work. A Fastify API gives a clear boundary at modest cost because it runs on the same VM.

### NestJS

Not selected because module/provider/decorator/guard/interceptor/DI concepts add framework learning that is not needed for this team size. Fastify plus explicit composition is easier to trace.

### Express

Fastify provides stronger schema/validation/plugin primitives while remaining explicit.

### Prisma-heavy ORM

The team wants SQL/query behavior visible. Kysely provides type safety without replacing the SQL mental model.

### Managed Supabase/Vercel backend

Not selected due to cost predictability and learning/operational preference. PostgreSQL + Docker preserves provider portability.

### Generic EAV

Rejected because filter-heavy listing queries become harder to query, index, and debug. Category migrations are accepted as the simpler tradeoff.

### Everything in JSONB

Rejected because the product is range/filter/sort heavy. Typed relational columns remain the main query surface.

### Microservices/Kubernetes

Rejected because they add deployment/networking/observability/failure-mode cost without a current scaling/team need.

## 26. External dependencies that do not block architecture

These remain integration/product inputs, not architecture ambiguity:

1. Exact EİDS access/protocol.
   - Fixed architecture: adapter, production fail-closed, mock local/test only.
2. Vehicle make/series/model source/license.
   - Fixed architecture: normalized reference tables + importer/seed path.
3. Turkey city/district/neighborhood source.
   - Fixed architecture: normalized location tables + importer/seed path.
4. Production VM provider/size.
   - Fixed architecture: portable Compose Linux deployment.
5. Final domain operational setup.
   - Does not alter application architecture.

## 27. Implementation order implied by the design

The implementation plan should roughly sequence:

1. monorepo/tooling skeleton,
2. local Docker PostgreSQL + migration foundation,
3. API bootstrap + health/error/contracts,
4. Better Auth configuration and generated schema verification,
5. reference tables + machine-readable listing schemas,
6. listing relational schema/repositories,
7. browse/list/filter/detail API,
8. listing creation/state transitions,
9. verification provider interface + mock/test implementation,
10. media abstraction/local provider/image processing,
11. moderation/reporting,
12. Next.js user journeys,
13. production Compose/Caddy/backup,
14. CI + critical tests.

The implementation plan may split these into smaller reviewable tasks but must not silently introduce rejected architecture components.

## 28. Guardrails for future agents

Before adding infrastructure, answer:

1. What measured/current problem does it solve?
2. Why can the existing simpler component not solve it acceptably?
3. What operational burden does the new component add?

If answers are speculative, do not add it.

Before taking a shortcut, ask:

1. Does it put SQL in routes/UI?
2. Does it make domain rules depend directly on provider SDKs/infrastructure?
3. Does it make future mobile/API/storage/verification extraction require a rewrite?

If yes, preserve the existing boundary even if slightly more verbose.

## 29. Primary feasibility references

- PostgreSQL 18: https://www.postgresql.org/docs/18/
- Better Auth PostgreSQL: https://better-auth.com/docs/adapters/postgresql
- Better Auth database/ID generation: https://better-auth.com/docs/concepts/database
- Better Auth Fastify: https://better-auth.com/docs/integrations/fastify
- Fastify: https://fastify.dev/docs/latest/
- Kysely: https://www.kysely.dev/docs/
- Next.js self-host/deploy: https://nextjs.org/docs/app/getting-started/deploying
- Docker Compose production: https://docs.docker.com/compose/how-tos/production/

## 30. Final proposed decision

Bizzat begins as a **self-hosted TypeScript modular monolith**:

```text
Next.js web
   -> REST contracts
Fastify API
   -> services/repositories
Kysely
   -> PostgreSQL 18
```

with:

- Better Auth in the API with UUID-compatible IDs,
- category-specific relational detail tables,
- schema-driven forms/filters,
- private/public local media behind a storage abstraction,
- EİDS behind a provider abstraction,
- Docker Compose + Caddy on one Linux VM,
- off-site backups,
- measured staged scaling instead of speculative distributed infrastructure.

The priority order is **clarity first, operational simplicity second, clean scaling exits third**.