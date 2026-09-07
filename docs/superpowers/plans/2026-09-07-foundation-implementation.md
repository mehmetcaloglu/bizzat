# Bizzat Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first working Bizzat codebase foundation: pnpm monorepo, shared API contracts, Fastify API, PostgreSQL 18 + Kysely migration/readiness layer, minimal Next.js web app, repeatable local developer workflow, and CI.

**Architecture:** This plan implements only the foundation of the approved self-hosted modular monolith. It deliberately stops before authentication, listing tables, listing filters, EİDS business flows, media uploads, or moderation. The result is one understandable repository where `web -> REST -> api -> PostgreSQL` already runs and is testable, without introducing infrastructure that later product plans do not yet need.

**Tech Stack:** Node.js 24 LTS, pnpm 10, TypeScript 6.0.3, Next.js 16.3.x + React 19.2.x, Fastify 5.x + TypeBox, Kysely 0.29.4 + `pg`, PostgreSQL 18, Vitest 4.1.x, ESLint 9 + typescript-eslint 8, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-07-technical-architecture-design.md`

## Global Constraints

- Architecture is a self-hosted TypeScript **modular monolith**; do not add microservices.
- First production database baseline is **PostgreSQL 18**.
- Web and API are separate applications in one pnpm monorepo.
- REST lives under `/api/v1`.
- Fastify uses schema-driven request/response validation; shared transport schemas live in `packages/contracts`.
- Kysely + `pg` is the DB access layer; do not add Prisma/Drizzle/another ORM.
- Production schema migrations must be explicit commands; do **not** auto-run migrations at API startup.
- PostgreSQL is the initial source of truth; do not add Redis, queues, Elasticsearch/OpenSearch/Meilisearch, replicas, or partitioning.
- No managed DB/auth/backend platform.
- Do not introduce Better Auth in this foundation plan; auth is the next independent plan.
- Do not introduce listing domain tables in this foundation plan; the first product schema belongs to the listing plan.
- Do not introduce Caddy/production deployment yet; production infra is a later plan. Local Docker is only for PostgreSQL here.
- Use stable releases only; no beta/RC/canary packages.
- Use Node.js `24.20.0` LTS for the implementation baseline. Node 26 is Current, not the baseline.
- Pin `typescript@6.0.3` for now instead of TypeScript 7 because the current typescript-eslint 8 line warns on TS7; revisit deliberately later instead of accepting unsupported-tooling warnings.
- Use `pnpm@10.34.5` as the package manager baseline rather than the newly released pnpm 12 major.
- Use `next@16.3.4`, `react@19.2.8`, `react-dom@19.2.8`, `fastify@5.12.3`, `kysely@0.29.4`, `vitest@4.1.11`, `typescript-eslint@8.69.0`, `@fastify/type-provider-typebox@6.1.0` as the reviewed baseline; `typebox` stays on stable `1.x` and the exact patch is pinned by `pnpm-lock.yaml` during implementation.

## Phase Map

This is **Plan 1** only. Do not stretch it into the whole MVP.

1. **Foundation — this plan:** workspace, contracts, API system boundary, DB/migrations/readiness, minimal web app, local dev, CI.
2. **Identity + reference data:** Better Auth, profiles/roles, Turkey location source, vehicle make/series/model source.
3. **Listing read vertical slice:** listing schema package, relational listing/detail tables, seed data, list/filter/search/detail API + web pages.
4. **Listing write vertical slice:** create/edit/state transitions, EİDS provider boundary/mock, media storage/image processing, publish flow + web forms.
5. **Moderation + production operations:** reports/moderation, Caddy/full production Compose, backups, deploy pipeline, production security checks.

## Target File Structure After This Plan

```text
bizzat/
  .github/
    workflows/
      ci.yml
  apps/
    api/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        app.ts
        server.ts
        config/
          env.ts
        common/
          errors/
            app-error.ts
            error-handler.ts
        db/
          client.ts
          check.ts
          migrator.ts
          migrations/
            0001_create_auth_schema.ts
        modules/
          system/
            system.routes.ts
      test/
        app.test.ts
        db.integration.test.ts
    web/
      package.json
      tsconfig.json
      vitest.config.ts
      next.config.ts
      next-env.d.ts
      app/
        globals.css
        layout.tsx
        page.tsx
      test/
        page.test.tsx
  packages/
    contracts/
      package.json
      tsconfig.json
      src/
        api-error.ts
        system.ts
        index.ts
  infra/
    postgres/
      init/
        001-create-test-db.sql
  .env.example
  .gitignore
  .nvmrc
  compose.dev.yml
  eslint.config.mjs
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
```

---

### Task 1: Workspace Toolchain + Shared Contract Package

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.nvmrc`
- Modify: `.gitignore`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/api-error.ts`
- Create: `packages/contracts/src/system.ts`
- Create: `packages/contracts/src/index.ts`
- Generated: `pnpm-lock.yaml`

**Interfaces:**
- Produces package `@bizzat/contracts` with `ApiErrorResponseSchema`, `HealthResponseSchema`, and `ReadyResponseSchema` for later API tasks.
- Produces root commands `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and later `pnpm dev`.
- Establishes Node/pnpm/TypeScript version constraints for every later plan.

- [ ] **Step 1: Add the root workspace manifest**

Create `package.json`:

```json
{
  "name": "bizzat",
  "private": true,
  "packageManager": "pnpm@10.34.5",
  "engines": {
    "node": ">=24.20.0 <25"
  },
  "scripts": {
    "contracts:build": "pnpm --filter @bizzat/contracts build",
    "predev": "pnpm contracts:build",
    "dev": "pnpm --parallel --filter @bizzat/contracts --filter @bizzat/api --filter @bizzat/web dev",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm contracts:build && pnpm -r --if-present typecheck",
    "test": "pnpm contracts:build && pnpm -r --if-present test",
    "build": "pnpm -r --if-present build",
    "db:migrate": "pnpm --filter @bizzat/api db:migrate"
  },
  "devDependencies": {
    "eslint": "9.39.5",
    "typescript": "6.0.3",
    "typescript-eslint": "8.69.0"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `.nvmrc`:

```text
24.20.0
```

- [ ] **Step 2: Add strict shared TypeScript defaults**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 3: Add the smallest useful lint configuration**

Create `eslint.config.mjs`:

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
```

Do not add Prettier/Biome/format-on-save policy in this task; formatting policy is independent and not required to get a tested foundation running.

- [ ] **Step 4: Expand `.gitignore` for the real codebase**

Preserve the existing secret/key rules and add:

```gitignore
node_modules/
dist/
.next/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
.DS_Store
Thumbs.db
*.log
*.pem
*.key
```

- [ ] **Step 5: Create the contracts package**

Create `packages/contracts/package.json`:

```json
{
  "name": "@bizzat/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc -p tsconfig.json --watch --preserveWatchOutput",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src --max-warnings=0"
  },
  "dependencies": {
    "typebox": "^1.0.0"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 6: Define the shared error contract**

Create `packages/contracts/src/api-error.ts`:

```ts
import { Type } from 'typebox'

export const ApiErrorCodeSchema = Type.Union([
  Type.Literal('VALIDATION_ERROR'),
  Type.Literal('UNAUTHENTICATED'),
  Type.Literal('FORBIDDEN'),
  Type.Literal('ROUTE_NOT_FOUND'),
  Type.Literal('DEPENDENCY_UNAVAILABLE'),
  Type.Literal('LISTING_NOT_FOUND'),
  Type.Literal('LISTING_NOT_EDITABLE'),
  Type.Literal('VERIFICATION_REQUIRED'),
  Type.Literal('VERIFICATION_FAILED'),
  Type.Literal('RATE_LIMITED'),
  Type.Literal('INTERNAL_ERROR'),
])

export const ApiErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: ApiErrorCodeSchema,
    message: Type.String(),
    requestId: Type.String(),
  }),
})
```

`ROUTE_NOT_FOUND` and `DEPENDENCY_UNAVAILABLE` are infrastructure-level additions to the architecture's initial error list; do not reuse listing-specific codes for generic routing/readiness failures.

- [ ] **Step 7: Define system endpoint contracts**

Create `packages/contracts/src/system.ts`:

```ts
import { Type } from 'typebox'

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
})

export const ReadyResponseSchema = Type.Object({
  status: Type.Literal('ready'),
  database: Type.Literal('ok'),
})
```

Create `packages/contracts/src/index.ts`:

```ts
export * from './api-error.js'
export * from './system.js'
```

- [ ] **Step 8: Install and pin dependencies**

Run:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
```

Expected: `pnpm-lock.yaml` is created and no prerelease packages are intentionally selected.

- [ ] **Step 9: Verify the contracts package compiles and lints**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/contracts typecheck
pnpm --filter @bizzat/contracts lint
```

Expected: all three commands exit `0`, and `packages/contracts/dist/index.js` + declarations exist.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.mjs .nvmrc .gitignore packages/contracts
git commit -m "chore: initialize TypeScript workspace and contracts"
```

---

### Task 2: Fastify API Boundary, Liveness, Readiness Interface, and Error Shape

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/common/errors/app-error.ts`
- Create: `apps/api/src/common/errors/error-handler.ts`
- Create: `apps/api/src/modules/system/system.routes.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/test/app.test.ts`

**Interfaces:**
- Consumes: `HealthResponseSchema`, `ReadyResponseSchema`, `ApiErrorResponseSchema` from `@bizzat/contracts`.
- Produces: `buildApp(options: BuildAppOptions): FastifyInstance`.
- Produces: injectable `readinessCheck: () => Promise<void>` boundary; Task 3 connects it to PostgreSQL.
- Produces API behavior:
  - `GET /api/v1/health` -> 200 `{ status: 'ok' }`
  - `GET /api/v1/ready` -> 200 when readiness succeeds
  - `GET /api/v1/ready` -> 503 standard error when dependency is unavailable
  - unknown route -> 404 standard error

- [ ] **Step 1: Add API package dependencies and scripts**

Create `apps/api/package.json`:

```json
{
  "name": "@bizzat/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test --max-warnings=0",
    "test": "vitest run test/app.test.ts",
    "test:integration": "vitest run test/db.integration.test.ts"
  },
  "dependencies": {
    "@bizzat/contracts": "workspace:*",
    "@fastify/type-provider-typebox": "6.1.0",
    "fastify": "5.12.3",
    "typebox": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.0.0",
    "vitest": "4.1.11"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["test", "dist"]
}
```

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
  },
})
```

Run `pnpm install` after adding the package manifest.

- [ ] **Step 2: Write failing API tests first**

Create `apps/api/test/app.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'

let app: FastifyInstance | undefined

afterEach(async () => {
  if (app) await app.close()
  app = undefined
})

describe('system endpoints', () => {
  it('returns liveness without touching dependencies', async () => {
    app = buildApp({
      logger: false,
      readinessCheck: async () => {
        throw new Error('health must not call readiness')
      },
    })

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('returns readiness when dependency check succeeds', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', database: 'ok' })
  })

  it('returns standard 503 when dependency check fails', async () => {
    app = buildApp({
      logger: false,
      readinessCheck: async () => {
        throw new Error('database offline')
      },
    })

    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' })
    const body = response.json()

    expect(response.statusCode).toBe(503)
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  it('returns the common error shape for an unknown route', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/not-real' })
    const body = response.json()

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('ROUTE_NOT_FOUND')
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/api test
```

Expected: FAIL because `../src/app.js` / `buildApp` does not exist yet.

- [ ] **Step 4: Implement explicit application errors**

Create `apps/api/src/common/errors/app-error.ts`:

```ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'ROUTE_NOT_FOUND'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'LISTING_NOT_FOUND'
  | 'LISTING_NOT_EDITABLE'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

- [ ] **Step 5: Implement the global error + not-found handlers**

Create `apps/api/src/common/errors/error-handler.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { AppError } from './app-error.js'

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint bulunamadı.',
        requestId: request.id,
      },
    })
  })

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Gönderilen bilgiler geçerli değil.',
          requestId: request.id,
        },
      })
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      })
    }

    request.log.error({ err: error }, 'unhandled request error')

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'İşlem tamamlanamadı.',
        requestId: request.id,
      },
    })
  })
}
```

- [ ] **Step 6: Implement the system module**

Create `apps/api/src/modules/system/system.routes.ts`:

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { ApiErrorResponseSchema, HealthResponseSchema, ReadyResponseSchema } from '@bizzat/contracts'
import { AppError } from '../../common/errors/app-error.js'

export interface SystemRoutesOptions {
  readinessCheck: () => Promise<void>
}

export const systemRoutes: FastifyPluginAsyncTypebox<SystemRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/health', {
    schema: {
      response: { 200: HealthResponseSchema },
    },
  }, async () => ({ status: 'ok' as const }))

  app.get('/ready', {
    schema: {
      response: {
        200: ReadyResponseSchema,
        503: ApiErrorResponseSchema,
      },
    },
  }, async () => {
    try {
      await options.readinessCheck()
    } catch {
      throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Servis henüz hazır değil.')
    }

    return { status: 'ready' as const, database: 'ok' as const }
  })
}
```

- [ ] **Step 7: Implement the Fastify app factory**

Create `apps/api/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import { registerErrorHandling } from './common/errors/error-handler.js'
import { systemRoutes } from './modules/system/system.routes.js'

export interface BuildAppOptions {
  readinessCheck: () => Promise<void>
  logger?: boolean
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
  })

  registerErrorHandling(app)
  app.register(systemRoutes, {
    prefix: '/api/v1',
    readinessCheck: options.readinessCheck,
  })

  return app
}
```

- [ ] **Step 8: Verify GREEN + typecheck + lint**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/api test
pnpm --filter @bizzat/api typecheck
pnpm --filter @bizzat/api lint
```

Expected: 4 API tests PASS; typecheck/lint exit `0`.

- [ ] **Step 9: Commit**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: bootstrap Fastify API boundary"
```

---

### Task 3: PostgreSQL 18, Kysely Connection, Explicit Migrations, and Real Readiness

**Files:**
- Create: `compose.dev.yml`
- Create: `infra/postgres/init/001-create-test-db.sql`
- Create: `.env.example`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/check.ts`
- Create: `apps/api/src/db/migrator.ts`
- Create: `apps/api/src/db/migrations/0001_create_auth_schema.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/test/db.integration.test.ts`

**Interfaces:**
- Produces `createDatabase(connectionString: string): Kysely<Database>`.
- Produces `checkDatabase(db: Kysely<Database>): Promise<void>` used by `/api/v1/ready`.
- Produces explicit `pnpm db:migrate`; server startup never runs migrations.
- Creates PostgreSQL schema `auth`, but does not create Better Auth tables yet.
- Local dev DB: `bizzat`; isolated integration DB: `bizzat_test`.

- [ ] **Step 1: Add PostgreSQL/Kysely dependencies and DB scripts**

Modify `apps/api/package.json` dependencies:

```json
{
  "dependencies": {
    "@bizzat/contracts": "workspace:*",
    "@fastify/type-provider-typebox": "6.1.0",
    "fastify": "5.12.3",
    "kysely": "0.29.4",
    "pg": "^8.22.0",
    "typebox": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/pg": "^8.20.0",
    "tsx": "^4.0.0",
    "vitest": "4.1.11"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test --max-warnings=0",
    "test": "vitest run test/app.test.ts",
    "test:integration": "vitest run test/db.integration.test.ts",
    "db:migrate": "tsx src/db/migrate-cli.ts"
  }
}
```

Add `apps/api/src/db/migrate-cli.ts` to the file list for this task. It is the command entrypoint; migration logic remains in `migrator.ts`.

Run `pnpm install`.

- [ ] **Step 2: Create local PostgreSQL 18 Compose service**

Create `compose.dev.yml`:

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: bizzat
      POSTGRES_PASSWORD: bizzat_dev
      POSTGRES_DB: bizzat
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - bizzat_postgres_data:/var/lib/postgresql
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bizzat -d bizzat"]
      interval: 2s
      timeout: 3s
      retries: 20

volumes:
  bizzat_postgres_data:
```

Important: PostgreSQL 18+ official Docker images persist at `/var/lib/postgresql`, not the old `/var/lib/postgresql/data` mount used by PostgreSQL 17 and older.

Create `infra/postgres/init/001-create-test-db.sql`:

```sql
CREATE DATABASE bizzat_test OWNER bizzat;
```

- [ ] **Step 3: Add environment template**

Create `.env.example`:

```dotenv
NODE_ENV=development
API_HOST=0.0.0.0
API_PORT=4000
LOG_LEVEL=info
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test
API_PROXY_TARGET=http://127.0.0.1:4000
```

Do not add real production secrets to this file.

- [ ] **Step 4: Write the failing DB integration test**

Create `apps/api/test/db.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { createDatabase, type Database } from '../src/db/client.js'
import { checkDatabase } from '../src/db/check.js'
import { migrateToLatest } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for DB integration tests')
}

let db: Kysely<Database>

beforeAll(async () => {
  db = createDatabase(databaseUrl)
})

afterAll(async () => {
  await db.destroy()
})

describe('database foundation', () => {
  it('connects to PostgreSQL', async () => {
    await expect(checkDatabase(db)).resolves.toBeUndefined()
  })

  it('runs versioned migrations and creates auth schema', async () => {
    await migrateToLatest(db)

    const result = await sql<{ schema_name: string }>`
      select schema_name
      from information_schema.schemata
      where schema_name = 'auth'
    `.execute(db)

    expect(result.rows).toEqual([{ schema_name: 'auth' }])
  })
})
```

- [ ] **Step 5: Start PostgreSQL and verify RED**

Run:

```bash
docker compose -f compose.dev.yml up -d postgres
until docker compose -f compose.dev.yml exec -T postgres pg_isready -U bizzat -d bizzat; do sleep 1; done
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm --filter @bizzat/api test:integration
```

Expected: FAIL because DB helper modules do not exist yet.

- [ ] **Step 6: Implement environment parsing without another config framework**

Create `apps/api/src/config/env.ts`:

```ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  logLevel: string
  databaseUrl: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`Unsupported NODE_ENV: ${nodeEnv}`)
  }

  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const port = Number(env.API_PORT ?? '4000')
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port')
  }

  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    host: env.API_HOST ?? '0.0.0.0',
    port,
    logLevel: env.LOG_LEVEL ?? 'info',
    databaseUrl,
  }
}
```

Do not introduce `dotenv` here. Node/process environment is the app boundary; local shell/Compose/CI supplies values. If the executor wants `.env` auto-loading for host development, use Node's supported env-file invocation in scripts rather than adding a config service abstraction.

- [ ] **Step 7: Implement Kysely connection and DB health check**

Create `apps/api/src/db/client.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const { Pool } = pg

export interface Database {}

export function createDatabase(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
      }),
    }),
  })
}
```

Create `apps/api/src/db/check.ts`:

```ts
import { sql, type Kysely } from 'kysely'
import type { Database } from './client.js'

export async function checkDatabase(db: Kysely<Database>): Promise<void> {
  await sql`select 1`.execute(db)
}
```

- [ ] **Step 8: Implement explicit migration infrastructure**

Create `apps/api/src/db/migrations/0001_create_auth_schema.ts`:

```ts
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createSchema('auth').ifNotExists().execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropSchema('auth').ifExists().cascade().execute()
}
```

Create `apps/api/src/db/migrator.ts`:

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator, type Kysely } from 'kysely'
import type { Database } from './client.js'

const migrationFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`Migration failed: ${result.migrationName}`)
    }
  }

  if (error) throw error
}
```

Create `apps/api/src/db/migrate-cli.ts`:

```ts
import { loadConfig } from '../config/env.js'
import { createDatabase } from './client.js'
import { migrateToLatest } from './migrator.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)

try {
  await migrateToLatest(db)
  console.log('Database migrations complete')
} finally {
  await db.destroy()
}
```

The API server must never import/call `migrateToLatest` on normal startup.

- [ ] **Step 9: Implement real server composition + graceful shutdown**

Create `apps/api/src/server.ts`:

```ts
import { buildApp } from './app.js'
import { loadConfig } from './config/env.js'
import { checkDatabase } from './db/check.js'
import { createDatabase } from './db/client.js'

const config = loadConfig()
const db = createDatabase(config.databaseUrl)
const app = buildApp({
  logger: true,
  readinessCheck: () => checkDatabase(db),
})

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await db.destroy()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await db.destroy()
  process.exit(1)
}
```

Do not run migrations in this file.

- [ ] **Step 10: Run migration + integration tests and verify GREEN**

Run:

```bash
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api db:migrate

TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm --filter @bizzat/api test:integration

pnpm --filter @bizzat/api test
pnpm --filter @bizzat/api typecheck
pnpm --filter @bizzat/api lint
pnpm --filter @bizzat/api build
```

Expected: migration exits `0`, both DB tests PASS, API unit tests PASS, build/typecheck/lint exit `0`.

- [ ] **Step 11: Manually verify liveness vs readiness**

Start API:

```bash
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api dev
```

In another shell:

```bash
curl -s http://127.0.0.1:4000/api/v1/health
curl -s http://127.0.0.1:4000/api/v1/ready
```

Expected:

```json
{"status":"ok"}
{"status":"ready","database":"ok"}
```

Then stop PostgreSQL only:

```bash
docker compose -f compose.dev.yml stop postgres
curl -i http://127.0.0.1:4000/api/v1/health
curl -i http://127.0.0.1:4000/api/v1/ready
```

Expected: `/health` remains 200; `/ready` returns 503 with `DEPENDENCY_UNAVAILABLE`. Restart PostgreSQL afterwards.

- [ ] **Step 12: Commit**

```bash
git add compose.dev.yml infra/postgres .env.example apps/api package.json pnpm-lock.yaml
git commit -m "feat: add PostgreSQL and migration foundation"
```

---

### Task 4: Minimal Next.js Web Application + Self-Host-Friendly Configuration

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/test/page.test.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces `@bizzat/web` Next.js App Router application.
- Browser API calls keep same-origin `/api/*`; local dev optionally rewrites to Fastify using `API_PROXY_TARGET`.
- Production build uses `output: 'standalone'` to support the later Docker/Caddy plan.
- No listing UI, auth UI, or Sahibinden clone components are added in this foundation task.

- [ ] **Step 1: Add web package manifest**

Create `apps/web/package.json`:

```json
{
  "name": "@bizzat/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app test next.config.ts --max-warnings=0",
    "test": "vitest run"
  },
  "dependencies": {
    "@bizzat/contracts": "workspace:*",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "4.1.11"
  }
}
```

Run `pnpm install`.

- [ ] **Step 2: Add Next TypeScript + standalone config**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "noEmit": true,
    "incremental": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }],
    "types": ["node"]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

Create `apps/web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited manually.
```

Create `apps/web/next.config.ts`:

```ts
import path from 'node:path'
import type { NextConfig } from 'next'

const apiProxyTarget = process.env.API_PROXY_TARGET

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  async rewrites() {
    if (!apiProxyTarget) return []

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
```

The monorepo tracing root matters because Next standalone output otherwise traces from `apps/web` and may miss workspace dependencies outside that directory.

- [ ] **Step 3: Write the failing page smoke test**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

Create `apps/web/test/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from '../app/page'

describe('foundation home page', () => {
  it('renders Bizzat identity and development status', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('bizzat')
    expect(html).toContain('Bireysel ilanların adresi.')
  })
})
```

- [ ] **Step 4: Run test and verify RED**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/web test
```

Expected: FAIL because `app/page.tsx` does not exist.

- [ ] **Step 5: Add the minimal app shell**

Create `apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bizzat',
  description: 'Bireysel ilanların adresi.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
```

Create `apps/web/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="foundation-shell">
      <section>
        <p className="wordmark">bizzat</p>
        <h1>Bireysel ilanların adresi.</h1>
        <p>Uygulama altyapısı hazırlanıyor.</p>
      </section>
    </main>
  )
}
```

Create `apps/web/app/globals.css`:

```css
:root {
  font-family: Arial, Helvetica, sans-serif;
  color: #30383f;
  background: #ffffff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.foundation-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #eff7fd;
}

.foundation-shell section {
  width: min(560px, 100%);
  padding: 32px;
  background: #ffffff;
  border: 1px solid #e5edf3;
  border-radius: 16px;
}

.wordmark {
  margin: 0 0 16px;
  color: #66b7f2;
  font-size: 32px;
  font-weight: 700;
}
```

This is intentionally a throwaway foundation shell, not the product homepage implementation. Do not expand this into the Sahibinden-inspired design during this task.

- [ ] **Step 6: Verify web tests, typecheck, lint, and production build**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/web test
pnpm --filter @bizzat/web typecheck
pnpm --filter @bizzat/web lint
pnpm --filter @bizzat/web build
```

Expected: test PASS, build exits `0`, and `.next/standalone` exists.

- [ ] **Step 7: Verify local API proxy without creating a frontend API abstraction yet**

Start PostgreSQL + API:

```bash
docker compose -f compose.dev.yml up -d postgres
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api dev
```

Start web in another shell:

```bash
API_PROXY_TARGET=http://127.0.0.1:4000 pnpm --filter @bizzat/web dev
```

Verify:

```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

Expected:

```json
{"status":"ok"}
```

Do not add a generic fetch/client abstraction until a real product endpoint exists; otherwise the foundation would be designing an API client without requirements.

- [ ] **Step 8: Commit**

```bash
git add apps/web .env.example package.json pnpm-lock.yaml
git commit -m "feat: add self-hosted Next.js web foundation"
```

---

### Task 5: Repository-Level Developer Workflow + Agent Instructions

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `package.json` if the exact dev scripts need correction after real execution

**Interfaces:**
- Produces one documented local workflow a frontend-oriented developer can follow without knowing Docker/PostgreSQL internals.
- Produces authoritative build/test commands for future coding agents.

- [ ] **Step 1: Verify the root commands before documenting them**

With PostgreSQL running:

```bash
pnpm contracts:build
pnpm lint
pnpm typecheck
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test pnpm test
pnpm build
```

If a root script does not correctly traverse the workspace, fix the root script now rather than documenting a workaround.

Expected: all commands exit `0`.

- [ ] **Step 2: Add a concise developer quick start to `README.md`**

Add a `## Development` section with this exact flow:

```markdown
## Development

Requirements:

- Node.js 24 LTS (`.nvmrc`)
- pnpm 10.34.5 via Corepack
- Docker Desktop / Docker Engine with Compose

Start the local database:

```bash
docker compose -f compose.dev.yml up -d postgres
```

Install dependencies and migrate the development DB:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
cp .env.example .env
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat pnpm db:migrate
```

Run API and web during development:

```bash
pnpm dev
```

Default local addresses:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- PostgreSQL: `127.0.0.1:5432`

Before opening a PR:

```bash
pnpm lint
pnpm typecheck
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test pnpm test
pnpm build
```
```

If `pnpm dev` cannot consume `.env` automatically, do not tell developers to export five variables manually on every shell. Adjust the root dev command to use Node's supported env-file mechanism or a tiny transparent script; do not add a configuration framework.

- [ ] **Step 3: Update `AGENTS.md` with the executable project rules**

Add a `## Teknik çalışma komutları` section:

```markdown
## Teknik çalışma komutları

- Node baseline: 24 LTS; `.nvmrc` is authoritative.
- Package manager: pnpm 10.34.5; do not replace it with npm/yarn.
- Local PostgreSQL: `docker compose -f compose.dev.yml up -d postgres`.
- DB migrations: `pnpm db:migrate`; API startup must not auto-run migrations.
- Validate changes with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- DB/repository behavior requires real PostgreSQL integration tests; do not replace SQL tests with repository mocks.
- Do not add Redis, queue, external search, microservice, Kubernetes or a managed backend service without a measured requirement and an architecture decision update.
```

Also update the old text that says there is no application code/build/CI; it becomes stale after this plan is implemented.

- [ ] **Step 4: Run the documented commands exactly as written**

Copy/paste the README commands in a clean shell. Do not mentally substitute different commands.

Expected:

- DB becomes healthy.
- migration succeeds.
- `pnpm dev` starts API/web.
- health endpoint responds.
- lint/typecheck/test/build all pass.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md package.json pnpm-lock.yaml
git commit -m "docs: document local development workflow"
```

---

### Task 6: GitHub CI for Lint, Typecheck, Real PostgreSQL Tests, and Builds

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces one PR CI workflow that uses PostgreSQL 18 and the same Node/pnpm baselines as local development.
- CI proves contracts/API/web compile, API unit tests pass, real PostgreSQL integration tests pass, and production builds succeed.
- Does not deploy anything.

- [ ] **Step 1: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_USER: bizzat
          POSTGRES_PASSWORD: bizzat_ci
          POSTGRES_DB: bizzat_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U bizzat -d bizzat_test"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 20

    env:
      TEST_DATABASE_URL: postgresql://bizzat:bizzat_ci@127.0.0.1:5432/bizzat_test
      DATABASE_URL: postgresql://bizzat:bizzat_ci@127.0.0.1:5432/bizzat_test
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.34.5
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 24.20.0
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm --filter @bizzat/api test

      - name: Database migration
        run: pnpm --filter @bizzat/api db:migrate

      - name: Database integration tests
        run: pnpm --filter @bizzat/api test:integration

      - name: Web tests
        run: pnpm --filter @bizzat/web test

      - name: Build
        run: pnpm build
```

Do not add deployment, Docker image publishing, coverage gates, security scanners, Playwright, or matrix builds in this foundation CI. They belong to later plans when the relevant software exists.

- [ ] **Step 2: Run the CI command sequence locally before pushing**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bizzat/api test
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test pnpm --filter @bizzat/api db:migrate
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test pnpm --filter @bizzat/api test:integration
pnpm --filter @bizzat/web test
pnpm build
```

Expected: every command exits `0`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: verify foundation on PostgreSQL 18"
```

- [ ] **Step 4: Push and verify the actual GitHub Actions run**

After opening/updating the implementation PR, inspect the CI run. Completion criterion is an actual green `CI / verify` job, not only a locally valid YAML file.

If CI differs from local behavior, fix the real underlying environment mismatch; do not add `continue-on-error` or skip failing steps.

---

## Foundation Acceptance Checklist

The foundation plan is complete only when all of these are true on the implementation branch:

- [ ] `pnpm-lock.yaml` exists and uses the reviewed stable dependency lines; no intentional prerelease dependencies.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] API unit tests pass.
- [ ] PostgreSQL integration tests pass against PostgreSQL 18.
- [ ] `pnpm build` builds contracts, API, and Next.js.
- [ ] `GET /api/v1/health` returns 200 independent of DB readiness.
- [ ] `GET /api/v1/ready` returns 200 with DB up and 503 with DB down.
- [ ] migrations run only through explicit `pnpm db:migrate`, not API startup.
- [ ] PostgreSQL 18 local volume is mounted at `/var/lib/postgresql`.
- [ ] web app runs on port 3000 and local `/api/*` proxy reaches Fastify.
- [ ] `.next/standalone` is produced.
- [ ] README quick-start commands work when copied literally.
- [ ] `AGENTS.md` no longer claims the repo has no code/tests/build.
- [ ] GitHub Actions `CI / verify` is green.
- [ ] No auth/listing/EİDS/media/moderation product implementation has leaked into this foundation plan.
- [ ] No Redis, queue, search cluster, Kubernetes, microservice, managed backend, or other rejected infrastructure was added.

## References Rechecked While Writing This Plan

- Node.js release status: Node 24 is LTS; Node 26 is Current.
- Next.js 16.3 is the active LTS line; recent 16.3 security patches are available. Next self-hosting supports Node/Docker and recommends a reverse proxy for production.
- Next standalone output is supported and monorepos need deliberate output file tracing roots.
- Fastify latest stable major is v5; its official TypeBox type-provider integration is supported in v5.
- Kysely 0.29.4 is the latest stable release while 0.30 is beta; `Migrator` + `FileMigrationProvider` are the supported migration primitives.
- PostgreSQL 18 official Docker image changed its persistent volume root to `/var/lib/postgresql`.
- TypeScript 7 is stable, but the current typescript-eslint 8 line explicitly warns when TS7 is detected; this plan therefore pins TS 6.0.3 conservatively.

