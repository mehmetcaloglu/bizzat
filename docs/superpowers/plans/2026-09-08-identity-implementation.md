# Bizzat Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-hosted email/password authentication, persistent sessions, Bizzat user profiles/roles, an authenticated `/api/v1/me` endpoint, and minimal Next.js login/register/session UI.

**Architecture:** Better Auth runs inside the existing Fastify API and stores only authentication/session data in PostgreSQL schema `auth`. Bizzat-owned authorization data stays in `public.profiles`; the API resolves the Better Auth session first and then loads/creates the profile. All schema changes remain explicit migration commands; API startup never auto-migrates.

**Tech Stack:** Better Auth `1.7.3`, Fastify `5.12.3`, PostgreSQL 18, Kysely `0.29.4`, Next.js `16.3.4`, React `19.2.8`, Vitest `4.1.11`.

**Spec:** `docs/superpowers/specs/2026-09-07-technical-architecture-design.md`

## Global Constraints

- Self-hosted modular monolith; no managed auth service.
- Email/password only in this phase. No Google/Apple/social login.
- No email verification or password-reset email provider in this phase.
- Better Auth tables live in PostgreSQL schema `auth`.
- Bizzat roles live in `public.profiles`, not as a user-controlled Better Auth field.
- Allowed roles: `user`, `moderator`, `admin`; public sign-up always receives `user`.
- Better Auth IDs use UUID strategy.
- Browser session uses Better Auth cookies; do not add custom JWT auth.
- Auth routes live at `/api/auth/*`; Bizzat application REST remains under `/api/v1`.
- API startup must not run migrations.
- Production requires `BETTER_AUTH_SECRET` with at least 32 characters and an explicit `BETTER_AUTH_URL`.
- No reference-data work (Turkey locations, vehicle catalog) in this PR.

---

### Task 1: Better Auth server config + explicit auth migrations

**Files:**
- Modify: `apps/api/package.json`
- Modify: `.env.example`
- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/auth/auth.ts`
- Create: `apps/api/src/auth/auth-migrator.ts`
- Modify: `apps/api/src/db/migrate-cli.ts`
- Test: `apps/api/test/auth-migration.integration.test.ts`

**Interfaces:**
- Produces `createAuth(config: AuthConfig)`.
- Produces `migrateAuth(auth): Promise<void>`.
- Explicit migration order: app bootstrap migrations → Better Auth schema migration.

- [ ] **Step 1: add Better Auth dependency**

Use `better-auth@1.7.3`. Keep `pg` as the database driver.

- [ ] **Step 2: extend config**

Add to `AppConfig`:

```ts
betterAuthUrl: string
betterAuthSecret: string
```

`loadConfig()` reads `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. Require both in all environments so local/CI behavior matches production. Reject secrets shorter than 32 characters.

Add to `.env.example`:

```dotenv
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=bizzat-local-development-secret-000001
```

- [ ] **Step 3: create auth factory**

Create `apps/api/src/auth/auth.ts`:

```ts
import { betterAuth } from 'better-auth'
import pg from 'pg'

const { Pool } = pg

export interface AuthConfig {
  databaseUrl: string
  baseUrl: string
  secret: string
}

function withAuthSearchPath(connectionString: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('options', '-c search_path=auth')
  return url.toString()
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    appName: 'Bizzat',
    baseURL: config.baseUrl,
    basePath: '/api/auth',
    secret: config.secret,
    database: new Pool({
      connectionString: withAuthSearchPath(config.databaseUrl),
      max: 10,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
    }),
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      database: {
        generateId: 'uuid',
        joins: true,
      },
    },
  })
}

export type BizzatAuth = ReturnType<typeof createAuth>
```

- [ ] **Step 4: programmatic Better Auth migration**

Create `apps/api/src/auth/auth-migrator.ts`:

```ts
import { getMigrations } from 'better-auth/db/migration'
import type { BizzatAuth } from './auth.js'

export async function migrateAuth(auth: BizzatAuth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
```

- [ ] **Step 5: update explicit migration CLI**

`migrate-cli.ts` must:

1. run existing Kysely migrations so schema `auth` exists,
2. create Better Auth with the same DB URL,
3. run `migrateAuth(auth)`,
4. destroy Kysely DB in `finally`.

Do not import migration code from `server.ts`.

- [ ] **Step 6: integration test**

Add a test that runs `migrateToLatest(db)` then `migrateAuth(auth)` against `TEST_DATABASE_URL` and verifies schema `auth` contains tables `user`, `session`, `account`, and `verification`, with `auth.user.id` reported as PostgreSQL `uuid`.

Run:

```bash
pnpm --filter @bizzat/api test:integration
pnpm --filter @bizzat/api typecheck
pnpm --filter @bizzat/api lint
pnpm --filter @bizzat/api build
```

Expected: all pass.

---

### Task 2: Profiles, roles, and authenticated request context

**Files:**
- Create: `apps/api/src/db/migrations/0002_create_profiles.ts`
- Modify: `apps/api/src/db/client.ts`
- Create: `apps/api/src/modules/users/profile.repository.ts`
- Create: `apps/api/src/auth/session.ts`
- Create: `packages/contracts/src/me.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/modules/users/me.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/me.integration.test.ts`

**Interfaces:**
- Role type: `'user' | 'moderator' | 'admin'`.
- `getSessionUser(requestHeaders)` resolves Better Auth session.
- `ensureProfile(userId)` idempotently creates default role `user`.
- `GET /api/v1/me` returns `{ user: { id, name, email }, profile: { role } }` or standard `UNAUTHENTICATED`.

- [ ] **Step 1: create `profiles` table**

Migration creates:

```text
profiles
  user_id uuid primary key references auth."user"(id) on delete cascade
  role text not null default 'user'
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

Add DB check constraint:

```sql
role in ('user', 'moderator', 'admin')
```

Because this FK requires Better Auth tables, update migration orchestration so `0002_create_profiles` runs only after Better Auth migration. Implement this by splitting the existing migrator into:

```ts
migrateBootstrap(db) // only 0001_create_auth_schema
migrateDomain(db)    // 0002+ using separate Kysely migration table name
```

Use migration table names `bizzat_bootstrap_migration` and `bizzat_domain_migration` to keep phases explicit.

- [ ] **Step 2: profile repository**

Implement:

```ts
export type UserRole = 'user' | 'moderator' | 'admin'

export interface Profile {
  userId: string
  role: UserRole
}

export async function ensureProfile(
  db: Kysely<Database>,
  userId: string,
): Promise<Profile>
```

Use PostgreSQL `on conflict (user_id) do nothing`, then select the row. Public sign-up never accepts a role input.

- [ ] **Step 3: session helper**

Use Better Auth `auth.api.getSession({ headers: fromNodeHeaders(headers) })`. Return `null` for unauthenticated requests. Do not parse cookies manually.

- [ ] **Step 4: `/api/v1/me` contract + route**

Add TypeBox response schema and route. The route resolves session, throws `AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')` when absent, ensures profile, then returns user/profile.

- [ ] **Step 5: integration tests**

Tests must prove:

- no cookie → 401 common error shape,
- authenticated user → 200 with role `user`,
- first `/me` call creates one profile,
- repeated `/me` does not create duplicates.

---

### Task 3: Fastify Better Auth HTTP bridge + auth lifecycle tests

**Files:**
- Create: `apps/api/src/auth/auth.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/test/auth.integration.test.ts`

**Interfaces:**
- Fastify handles `GET|POST /api/auth/*` and delegates to `auth.handler(Request)`.
- All Better Auth response status/headers/body, especially repeated `Set-Cookie`, are forwarded to Fastify response.
- `buildApp()` receives the auth instance and DB dependency explicitly.

- [ ] **Step 1: implement the Fastify bridge**

Use `fromNodeHeaders` from `better-auth/node`. Construct a Fetch `Request` from Fastify request method/url/headers/body, call `auth.handler`, copy status, copy all response headers, and send response body.

When forwarding cookies, preserve every `Set-Cookie` value; do not concatenate multiple cookies into one malformed header.

- [ ] **Step 2: integration tests through Fastify**

Use real PostgreSQL and `app.inject()` to prove:

1. `POST /api/auth/sign-up/email` creates a UUID user,
2. duplicate email is rejected,
3. `POST /api/auth/sign-in/email` returns a session cookie,
4. cookie can access `/api/v1/me`,
5. `POST /api/auth/sign-out` invalidates that session.

Do not replace these with mocked Better Auth calls.

---

### Task 4: Minimal Next.js login/register/session UI

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/auth-client.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/register/page.tsx`
- Create: `apps/web/app/components/auth-form.tsx`
- Create: `apps/web/app/components/session-panel.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/test/auth-ui.test.tsx`

**Interfaces:**
- Browser uses `createAuthClient()` from `better-auth/react`; same-origin `/api/auth` means no separate browser API URL.
- Register fields: name, email, password.
- Login fields: email, password.
- Minimum password guidance: 8 characters, matching Better Auth default.

- [ ] **Step 1: auth client**

```ts
'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
```

- [ ] **Step 2: shared auth form**

Client component supports `mode: 'login' | 'register'`; calls `authClient.signIn.email` or `authClient.signUp.email`. On success use `window.location.href = '/'`. Display Better Auth error message in a single accessible status region.

- [ ] **Step 3: pages and home session panel**

Add `/login`, `/register`, and a small home session panel using `authClient.useSession()`. Logged-out state links to login/register. Logged-in state shows name/email and a logout button.

Do not implement dashboard, profile editing, password reset, social providers, or visual polish beyond existing Bizzat foundation styling.

- [ ] **Step 4: tests**

Static/component smoke tests verify login/register labels and logged-out links. API integration tests remain the source of truth for actual auth behavior.

---

### Task 5: CI, docs, and final identity verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: CI env**

Add:

```yaml
BETTER_AUTH_URL: http://localhost:3000
BETTER_AUTH_SECRET: bizzat-ci-auth-secret-00000000000001
```

CI keeps PostgreSQL 18, frozen lockfile, explicit `pnpm db:migrate`, lint/typecheck/test/build.

- [ ] **Step 2: docs**

README documents email/password auth, `/api/auth/*`, `/api/v1/me`, and that email verification/password reset/social login are not yet enabled.

AGENTS states:

- never accept role from public sign-up input,
- use `profiles.role` for Bizzat authorization,
- use Better Auth session APIs rather than custom cookie/JWT parsing,
- auth migrations are explicit and production startup must fail rather than silently migrate.

- [ ] **Step 3: final verification**

Run in CI with real PostgreSQL:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Acceptance criteria:

- Better Auth core tables exist in schema `auth` and IDs are UUID,
- public sign-up/sign-in/sign-out work over Fastify HTTP bridge,
- sessions survive across requests through cookie,
- `/api/v1/me` returns default `user` role and rejects anonymous requests,
- profile creation is idempotent,
- minimal web login/register/session UI builds,
- no auth migrations run from API startup,
- no reference-data or listing implementation leaked into this PR.
