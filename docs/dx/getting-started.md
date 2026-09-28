# Getting Started

> Local development setup for the ParishBooks monorepo.

## Table of Contents

1. Local Setup (Nx, Postgres, Env Vars)
2. Running a Single Service vs. the Full Stack
3. Seeding Tenant / Organization Test Data
4. Where to Find Each Doc

## 1. Local Setup

```bash
bun install
docker compose up -d postgres kong  # Postgres + Kong (declarative routes)
cp .env.example .env
npx typeorm migration:run -d libs/shared/typeorm/data-source.ts
```

`synchronize` is always `false` (`docs/specs/typeorm-database-schema.md`
§3) — local dev runs real migrations, the same ones CI and production
run, so a broken migration is caught before it's ever merged.

## 2. Running a Single Service vs. the Full Stack

```bash
npx nx serve parishbooks-auth-svc                 # one service
npx nx run-many -t serve -p parishbooks-auth-svc,parishbooks-org-svc
```

**Full stack (services + back-office):**

1. Start Kong: `docker compose up -d kong` (proxy on `http://localhost:8000`).
2. Run the Nest services you need (`nx serve …`) — ports in `.env`.
3. In `parishbooks-backoffice`: set `API_BASE_URL=http://localhost:8000/api`
   in `.env.local`, then `bun dev`.

Server actions call Kong with the session JWT; the browser does not call
Nest ports directly. See `docs/architecture/kong-routing.md`.

## 3. Seeding Tenant / Organization Test Data

A seed script creates a demo `Organization` (through the BetterAuth
TypeORM adapter — `docs/architecture/multi-tenancy-betterauth.md`) plus
its `OrganizationProfile`, a default chart of accounts
(`docs/specs/double-entry-ledger.md` §2), a couple of `Fund`s, and a
handful of `Member`/`Family` records — enough to exercise the Give flow
and CRM screens locally without hand-creating records through the UI
every time the DB is reset.

## 4. Where to Find Each Doc

- Architecture & topology → `docs/architecture/`
- Entity/feature specs → `docs/specs/`
- Payment & billing integrations → `docs/integrations/`
- Tax/compliance rules → `docs/compliance/`
- Testing, CI/CD, security → `docs/quality-ops/`
- Operational rules for AI agents & devs → root `CLAUDE.md`
