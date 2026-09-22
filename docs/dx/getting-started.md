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
docker compose up -d postgres      # local Postgres instance
cp .env.example .env                # per app, where present
npx typeorm migration:run -d libs/shared/typeorm/data-source.ts
```

`synchronize` is always `false` (`docs/specs/typeorm-database-schema.md`
§3) — local dev runs real migrations, the same ones CI and production
run, so a broken migration is caught before it's ever merged.

## 2. Running a Single Service vs. the Full Stack

```bash
npx nx serve parishbooks-auth-svc                 # one service
npx nx run-many -t serve -p parishbooks-auth-svc,parishbooks-gateway,parishbooks-member-svc
```

A `docker-compose` profile that boots the full service set plus Postgres
in one command is worth adding once there are enough services that
running them individually gets tedious — not before.

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
