# Bizzat Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Bizzat code foundation: pnpm monorepo, shared REST contracts, Fastify API, PostgreSQL 18 + explicit Kysely migrations/readiness, minimal Next.js web app, repeatable local developer workflow, and CI.

**Architecture:** This plan implements only the foundation of the approved self-hosted modular monolith. It deliberately stops before Better Auth, listing domain tables, EİDS business flows, media uploads, moderation, Caddy, and production deployment. At the end, `web -> REST -> api -> PostgreSQL` runs locally and is tested without premature infrastructure.

**Tech Stack:** Node.js 24 LTS, pnpm 10, TypeScript 6.0.3, Next.js 16.3.x + React 19.2.x, Fastify 5.x + TypeBox, Kysely 0.29.4 + `pg`, PostgreSQL 18, Vitest 4.1.x, ESLint 9 + typescript-eslint 8, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-07-technical-architecture-design.md`

## Global Constraints

- Architecture is a self-hosted TypeScript **modular monolith**; do not add microservices.
- First production DB baseline is **PostgreSQL 18**.
- Web and API are separate apps in one pnpm monorepo.
- REST lives under `/api/v1`.
- Fastify uses schema-driven request/response validation; shared transport schemas live in `packages/contracts`.
- Kysely + `pg` is the DB layer; do not add Prisma, Drizzle, or another ORM.
- Migrations are explicit commands; API startup must **not** auto-run migrations.
- PostgreSQL is the source of truth; do not add Redis, queues, external search, replicas, or partitioning.
- No managed DB/auth/backend platform.
- Better Auth is **not** implemented in this plan; it is Plan 2.
- Listing tables/filters are **not** implemented in this plan; they are Plan 3.
- Caddy/full production Compose/backup deployment are **not** implemented in this plan; they are Plan 5.
- Use stable releases only; no beta/RC/canary packages.
- Node baseline: `24.20.0` LTS. Node 26 Current is not the baseline.
- pnpm baseline: `10.34.5`.
- TypeScript baseline: `6.0.3`; do not jump to TS7 while the selected typescript-eslint line reports unsupported-version warnings.
- Reviewed package baseline: `next@16.3.4`, `react@19.2.8`, `react-dom@19.2.8`, `fastify@5.12.3`, `kysely@0.29.4`, `vitest@4.1.11`, `typescript-eslint@8.69.0`, `@fastify/type-provider-typebox@6.1.0`. `pnpm-lock.yaml` pins exact transitive versions.

## Phase Map

1. **Foundation — this plan:** workspace, contracts, system API, DB/migrations/readiness, minimal web, local dev, CI.
2. **Identity + reference data:** Better Auth, profiles/roles, Turkey locations, vehicle make/series/model source.
3. **Listing read vertical slice:** listing schema package, relational listing/detail tables, list/filter/search/detail API + web.
4. **Listing write vertical slice:** create/edit/state transitions, EİDS provider/mock, media, publish flow + forms.
5. **Moderation + production operations:** reports/moderation, Caddy/full production Compose, backups, deploy/security checks.

## Target File Structure After This Plan

```text
bizzat/
  .github/workflows/ci.yml
  apps/
    api/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        app.ts
        server.ts
        config/env.ts
        common/errors/app-error.ts
        common/errors/error-handler.ts
        db/client.ts
        db/check.ts
        db/migrator.ts
        db/migrate-cli.ts
        db/migrations/0001_create_auth_schema.ts
        modules/system/system.routes.ts
      test/app.test.ts
      test/db.integration.test.ts
    web/
      package.json
      tsconfig.json
      vitest.config.ts
      next.config.ts
      next-env.d.ts
      app/globals.css
      app/layout.tsx
      app/page.tsx
      test/page.test.tsx
  packages/contracts/
    package.json
    tsconfig.json
    src/api-error.ts
    src/system.ts
    src/index.ts
  infra/postgres/init/001-create-test-db.sql
  scripts/run-pnpm.mjs
  .env.example
  .nvmrc
  compose.dev.yml
  eslint.config.mjs
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
```

---

### Task 1: Workspace Toolchain + Shared Contracts

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
- Produces package `@bizzat/contracts`.
- Produces `ApiErrorResponseSchema`, `HealthResponseSchema`, `ReadyResponseSchema`.
- Establishes root lint/typecheck/build conventions used by all later tasks.

- [ ] **Step 1: Create root workspace files**

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
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm contracts:build && pnpm -r --if-present typecheck",
    "build": "pnpm -r --if-present build"
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

- [ ] **Step 2: Add strict TypeScript defaults**

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

- [ ] **Step 3: Add minimal ESLint config**

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

Do not add a formatter or framework-specific lint plugin just to make the foundation look more complete.

- [ ] **Step 4: Expand `.gitignore` without weakening secret rules**

Ensure `.gitignore` contains:

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

- [ ] **Step 6: Define shared API error contract**

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

- [ ] **Step 7: Define system contracts and exports**

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

- [ ] **Step 8: Install and verify package resolution**

Run:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
pnpm contracts:build
pnpm --filter @bizzat/contracts typecheck
pnpm --filter @bizzat/contracts lint
```

Expected: all commands exit `0`; `pnpm-lock.yaml`, `packages/contracts/dist/index.js`, and declarations exist.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.mjs .nvmrc .gitignore packages/contracts
git commit -m "chore: initialize TypeScript workspace and contracts"
```

---

### Task 2: Fastify API Boundary + Standard Errors

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
- Consumes shared system/error contracts.
- Produces `buildApp(options: BuildAppOptions): FastifyInstance`.
- Produces injectable `readinessCheck: () => Promise<void>`; Task 3 connects it to PostgreSQL.
- `GET /api/v1/health` is liveness.
- `GET /api/v1/ready` is dependency-aware readiness.

- [ ] **Step 1: Create API package**

Create `apps/api/package.json`:

```json
{
  "name": "@bizzat/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test --max-warnings=0",
    "test": "vitest run test/app.test.ts"
  },
  "dependencies": {
    "@bizzat/contracts": "workspace:*",
    "@fastify/type-provider-typebox": "6.1.0",
    "fastify": "5.12.3",
    "typebox": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
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

Run `pnpm install`.

- [ ] **Step 2: Write API tests before app code**

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
  it('keeps liveness independent from readiness dependencies', async () => {
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

  it('returns ready when dependency check succeeds', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', database: 'ok' })
  })

  it('returns standard 503 when readiness dependency fails', async () => {
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

  it('returns the common shape for unknown routes', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/not-real' })
    const body = response.json()

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('ROUTE_NOT_FOUND')
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/api test
```

Expected: FAIL because `buildApp` does not exist.

- [ ] **Step 4: Implement explicit application error type**

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

- [ ] **Step 5: Implement global error/not-found handling**

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

- [ ] **Step 6: Implement system routes**

Create `apps/api/src/modules/system/system.routes.ts`:

```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  ReadyResponseSchema,
} from '@bizzat/contracts'
import { AppError } from '../../common/errors/app-error.js'

export interface SystemRoutesOptions {
  readinessCheck: () => Promise<void>
}

export const systemRoutes: FastifyPluginAsyncTypebox<SystemRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/health', {
    schema: { response: { 200: HealthResponseSchema } },
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

- [ ] **Step 7: Implement app factory**

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
  const app = Fastify({ logger: options.logger ?? true })

  registerErrorHandling(app)
  app.register(systemRoutes, {
    prefix: '/api/v1',
    readinessCheck: options.readinessCheck,
  })

  return app
}
```

- [ ] **Step 8: Verify GREEN**

Run:

```bash
pnpm contracts:build
pnpm --filter @bizzat/api test
pnpm --filter @bizzat/api typecheck
pnpm --filter @bizzat/api lint
pnpm --filter @bizzat/api build
```

Expected: 4 tests PASS; lint/typecheck/build exit `0`.

- [ ] **Step 9: Commit**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: bootstrap Fastify API boundary"
```

---

### Task 3: PostgreSQL 18 + Kysely + Explicit Migrations + Real Readiness

**Files:**
- Create: `compose.dev.yml`
- Create: `infra/postgres/init/001-create-test-db.sql`
- Create: `.env.example`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/check.ts`
- Create: `apps/api/src/db/migrator.ts`
- Create: `apps/api/src/db/migrate-cli.ts`
- Create: `apps/api/src/db/migrations/0001_create_auth_schema.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/test/db.integration.test.ts`

**Interfaces:**
- Produces `createDatabase(connectionString): Kysely<Database>`.
- Produces `checkDatabase(db): Promise<void>`.
- Produces `migrateToLatest(db): Promise<void>` and CLI script `db:migrate:raw`.
- Local DB `bizzat`, isolated integration DB `bizzat_test`.
- Creates only PostgreSQL schema `auth`; Better Auth tables come in Plan 2.

- [ ] **Step 1: Add DB/runtime dependencies and scripts**

Modify `apps/api/package.json` to include:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test --max-warnings=0",
    "test": "vitest run test/app.test.ts",
    "test:integration": "vitest run test/db.integration.test.ts",
    "db:migrate:raw": "tsx src/db/migrate-cli.ts"
  },
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
  }
}
```

Run `pnpm install`.

- [ ] **Step 2: Create PostgreSQL 18 local service**

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

For PostgreSQL 18+, use `/var/lib/postgresql`; do not copy the old PostgreSQL 17 `/var/lib/postgresql/data` volume convention.

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
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test
API_PROXY_TARGET=http://127.0.0.1:4000
```

- [ ] **Step 4: Write DB integration tests first**

Create `apps/api/test/db.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { createDatabase, type Database } from '../src/db/client.js'
import { checkDatabase } from '../src/db/check.js'
import { migrateToLatest } from '../src/db/migrator.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required')

let db: Kysely<Database>

beforeAll(() => {
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

- [ ] **Step 5: Start DB and verify RED**

Run:

```bash
docker compose -f compose.dev.yml up -d postgres
until docker compose -f compose.dev.yml exec -T postgres pg_isready -U bizzat -d bizzat; do sleep 1; done
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm --filter @bizzat/api test:integration
```

Expected: FAIL because DB helper modules do not exist.

- [ ] **Step 6: Implement transparent environment parsing**

Create `apps/api/src/config/env.ts`:

```ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
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
    databaseUrl,
  }
}
```

No config framework and no implicit production `.env` loading inside the API process.

- [ ] **Step 7: Implement Kysely DB connection and readiness check**

Create `apps/api/src/db/client.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const { Pool } = pg

export type Database = Record<never, never>

export function createDatabase(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 30000,
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

- [ ] **Step 8: Implement migration provider using Kysely's supported migration subpath**

Create `apps/api/src/db/migrations/0001_create_auth_schema.ts`:

```ts
import type { Kysely } from 'kysely'
import type { Database } from '../client.js'

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema.createSchema('auth').ifNotExists().execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropSchema('auth').ifExists().cascade().execute()
}
```

Create `apps/api/src/db/migrator.ts`:

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Kysely } from 'kysely'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import type { Database } from './client.js'

const migrationFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
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

API startup must never import/call `migrateToLatest`.

- [ ] **Step 9: Compose the real server and graceful shutdown**

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

- [ ] **Step 10: Verify migration, tests, typecheck, lint, build**

Run:

```bash
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api db:migrate:raw

TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm --filter @bizzat/api test:integration

pnpm contracts:build
pnpm --filter @bizzat/api test
pnpm --filter @bizzat/api typecheck
pnpm --filter @bizzat/api lint
pnpm --filter @bizzat/api build
```

Expected: migration exits `0`, 2 DB tests PASS, 4 API tests PASS, lint/typecheck/build exit `0`.

- [ ] **Step 11: Verify liveness and readiness differ correctly**

Start API:

```bash
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api dev
```

Check:

```bash
curl -s http://127.0.0.1:4000/api/v1/health
curl -s http://127.0.0.1:4000/api/v1/ready
```

Expected:

```json
{"status":"ok"}
{"status":"ready","database":"ok"}
```

Stop only DB and recheck:

```bash
docker compose -f compose.dev.yml stop postgres
curl -i http://127.0.0.1:4000/api/v1/health
curl -i http://127.0.0.1:4000/api/v1/ready
```

Expected: `/health` stays 200; `/ready` becomes 503 with `DEPENDENCY_UNAVAILABLE`. Restart DB afterwards.

- [ ] **Step 12: Commit**

```bash
git add compose.dev.yml infra/postgres .env.example apps/api pnpm-lock.yaml
git commit -m "feat: add PostgreSQL and migration foundation"
```

---

### Task 4: Minimal Next.js Web + Same-Origin Local API Proxy

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
- Modify: `package.json`

**Interfaces:**
- Produces `@bizzat/web` App Router app.
- Browser requests keep same-origin `/api/*`; local Next rewrites to Fastify via `API_PROXY_TARGET`.
- `output: 'standalone'` prepares for later Docker/Caddy work.
- No auth/listing UI yet.

- [ ] **Step 1: Create web package**

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

- [ ] **Step 2: Add Next TypeScript and standalone config**

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
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
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
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const apiProxyTarget = process.env.API_PROXY_TARGET
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
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

- [ ] **Step 3: Write page smoke test first**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

Create `apps/web/test/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from '../app/page'

describe('foundation home page', () => {
  it('renders Bizzat identity', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('bizzat')
    expect(html).toContain('Bireysel ilanların adresi.')
  })
})
```

- [ ] **Step 4: Verify RED**

Run:

```bash
pnpm --filter @bizzat/web test
```

Expected: FAIL because `app/page.tsx` does not exist.

- [ ] **Step 5: Add minimal app shell**

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

This shell is intentionally temporary. Do not start the real Sahibinden-inspired homepage in this task.

- [ ] **Step 6: Add final root test script now that API + web both exist**

Modify root `package.json` scripts to include:

```json
{
  "scripts": {
    "contracts:build": "pnpm --filter @bizzat/contracts build",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm contracts:build && pnpm -r --if-present typecheck",
    "test": "pnpm contracts:build && pnpm --filter @bizzat/api test && pnpm --filter @bizzat/api test:integration && pnpm --filter @bizzat/web test",
    "build": "pnpm -r --if-present build"
  }
}
```

The root `test` command intentionally includes the real PostgreSQL integration suite.

- [ ] **Step 7: Verify web + full workspace**

With PostgreSQL up and `TEST_DATABASE_URL` exported:

```bash
pnpm --filter @bizzat/web test
pnpm --filter @bizzat/web typecheck
pnpm --filter @bizzat/web lint
pnpm --filter @bizzat/web build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit `0`; `apps/web/.next/standalone` exists.

- [ ] **Step 8: Verify local Next -> Fastify rewrite**

Start API:

```bash
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat \
  pnpm --filter @bizzat/api dev
```

Start web in another shell:

```bash
API_PROXY_TARGET=http://127.0.0.1:4000 pnpm --filter @bizzat/web dev
```

Check:

```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

Expected:

```json
{"status":"ok"}
```

Do not invent a frontend API-client abstraction yet; add it with the first real product endpoint.

- [ ] **Step 9: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: add self-hosted Next.js web foundation"
```

---

### Task 5: One-Command Local Developer Workflow + Updated Repo Instructions

**Files:**
- Create: `scripts/run-pnpm.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- `pnpm dev` loads root `.env` if present and starts contracts watcher + API + web.
- `pnpm db:migrate` loads root `.env` if present and runs explicit API migration CLI.
- Future agents get authoritative build/test commands in `AGENTS.md`.

- [ ] **Step 1: Add tiny transparent env-aware pnpm runner**

Create `scripts/run-pnpm.mjs`:

```js
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

if (existsSync('.env')) {
  loadEnvFile('.env')
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(command, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
```

This is intentionally not a config framework. It only makes root `.env` available to child processes.

- [ ] **Step 2: Add ergonomic root scripts**

Modify root `package.json` scripts to:

```json
{
  "scripts": {
    "contracts:build": "pnpm --filter @bizzat/contracts build",
    "dev": "node scripts/run-pnpm.mjs --parallel --filter @bizzat/contracts --filter @bizzat/api --filter @bizzat/web dev",
    "db:up": "docker compose -f compose.dev.yml up -d postgres",
    "db:down": "docker compose -f compose.dev.yml down",
    "db:migrate": "node scripts/run-pnpm.mjs --filter @bizzat/api db:migrate:raw",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm contracts:build && pnpm -r --if-present typecheck",
    "test": "pnpm contracts:build && node scripts/run-pnpm.mjs --filter @bizzat/api test && node scripts/run-pnpm.mjs --filter @bizzat/api test:integration && node scripts/run-pnpm.mjs --filter @bizzat/web test",
    "build": "pnpm -r --if-present build"
  }
}
```

- [ ] **Step 3: Verify root developer commands before documenting**

Run from repo root:

```bash
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit `0`.

Then run:

```bash
pnpm dev
```

Expected: contracts watcher, API on `4000`, web on `3000`; `curl http://127.0.0.1:3000/api/v1/health` returns `{"status":"ok"}`.

- [ ] **Step 4: Add exact quick-start to README**

Add:

```markdown
## Development

Requirements:

- Node.js 24 LTS (`.nvmrc`)
- pnpm 10.34.5 via Corepack
- Docker Desktop / Docker Engine with Compose

Install and start:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm dev
```

Local addresses:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- PostgreSQL: `127.0.0.1:5432`

Before opening a PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
```

- [ ] **Step 5: Update `AGENTS.md` executable rules**

Add/update:

```markdown
## Teknik çalışma komutları

- Node baseline: 24 LTS; `.nvmrc` is authoritative.
- Package manager: pnpm 10.34.5; do not replace it with npm/yarn.
- Local PostgreSQL: `pnpm db:up`.
- DB migrations: `pnpm db:migrate`; API startup must not auto-run migrations.
- Validate code changes with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Repository/SQL behavior requires real PostgreSQL integration tests; do not replace them with repository mocks.
- Do not add Redis, queues, external search, microservices, Kubernetes, or managed backend services without a measured requirement and architecture update.
```

Remove/replace the old statement that the repo has no app code, tests, build, or CI.

- [ ] **Step 6: Copy/paste README commands in a fresh shell**

Expected:

- DB becomes healthy.
- explicit migration succeeds.
- `pnpm dev` starts API/web.
- proxied health endpoint works.
- lint/typecheck/test/build all pass.

If any README command fails, fix the command or script now; do not document a workaround.

- [ ] **Step 7: Commit**

```bash
git add scripts/run-pnpm.mjs package.json README.md AGENTS.md
git commit -m "docs: add repeatable local development workflow"
```

---

### Task 6: GitHub CI on PostgreSQL 18

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- PR/main CI uses same Node/pnpm/PostgreSQL baselines as local development.
- CI proves lint, typecheck, explicit migration CLI, API unit tests, real DB integration tests, web tests, and builds.
- No deploy/publish step.

- [ ] **Step 1: Create workflow**

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

      - name: Explicit migration command
        run: pnpm --filter @bizzat/api db:migrate:raw

      - name: Tests
        run: pnpm test

      - name: Build
        run: pnpm build
```

Do not add deployment, Docker publishing, coverage gates, security scanners, Playwright, or matrix builds before the corresponding product/ops plan exists.

- [ ] **Step 2: Run the same CI sequence locally**

With local PostgreSQL up:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm --filter @bizzat/api db:migrate:raw
TEST_DATABASE_URL=postgresql://bizzat:bizzat_dev@127.0.0.1:5432/bizzat_test \
  pnpm test
pnpm build
```

Expected: every command exits `0`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: verify foundation on PostgreSQL 18"
```

- [ ] **Step 4: Push and verify actual GitHub Actions**

Open/update the implementation PR and inspect the run.

Completion criterion: actual `CI / verify` job is green. Do not use `continue-on-error` or skip a failing verification step.

---

## Foundation Acceptance Checklist

Foundation is complete only when:

- [ ] `pnpm-lock.yaml` exists with no intentional prerelease dependency.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` includes API unit + real PostgreSQL integration + web tests and passes.
- [ ] `pnpm build` builds contracts, API, and Next.js.
- [ ] `/api/v1/health` is 200 even when DB is down.
- [ ] `/api/v1/ready` is 200 with DB up and 503 with DB down.
- [ ] migrations run only through explicit migration command, never API startup.
- [ ] local PostgreSQL 18 persists at `/var/lib/postgresql`.
- [ ] web runs on 3000; local `/api/*` rewrite reaches Fastify on 4000.
- [ ] Next produces `.next/standalone`.
- [ ] README quick-start works literally.
- [ ] `AGENTS.md` no longer claims there is no code/tests/build.
- [ ] GitHub Actions `CI / verify` is green.
- [ ] no Better Auth/listing/EİDS/media/moderation implementation leaked into this plan.
- [ ] no Redis/queue/search cluster/Kubernetes/microservice/managed backend was added.

## Plan Self-Review Result

- **Spec coverage:** foundation requirements are covered; intentionally independent auth, listings, write flows, moderation, and production ops are assigned to Plans 2–5 instead of being hidden in this plan.
- **Placeholder scan:** no `TBD`, `TODO`, “similar to”, or unspecified “add tests/error handling” steps remain.
- **Type/interface consistency:** `buildApp`, `readinessCheck`, `Database`, `createDatabase`, `checkDatabase`, and `migrateToLatest` names/signatures are consistent across consuming tasks.
- **Known corrections made during review:** Kysely migration imports use `kysely/migration`; the foundation `Database` type does not use an empty interface; API `dev` is added only when `server.ts` exists; root `pnpm test` explicitly includes DB integration; root `.env` handling is a transparent script rather than framework magic; Next tracing root is resolved from the config file instead of process cwd.
