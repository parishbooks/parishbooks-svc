# ParishBooks Documentation Repository — Blueprint Design

**Date:** 2026-08-31
**Status:** Approved
**Owner:** Engineering (ParishBooks)

## Context

ParishBooks is a new multi-tenant Church Management System (ChMS) and financial
back-office platform, about to begin implementation. The Nx workspace already
exists at the repo root (`parishbooks/`) with a single scaffolded NestJS app,
`apps/parishbooks-auth-svc`, and no libraries yet.

Before any further service code is written, the team needs a complete
documentation set covering architecture, feature specs, payments/compliance,
and quality/operations, plus a root `CLAUDE.md` operational guide for AI
agents and developers working in this monorepo.

## Decisions

1. **Compliance scope — India-first.** `tax-receipts-80g-501c3.md` treats
   Indian compliance (80G, PAN capture, FCRA fund segregation) as the
   primary, launch-blocking path. US 501(c)(3) statement support is
   documented as a scoped Phase 2 addendum with explicit deltas from the
   India model — not built out in equal depth today.
2. **Deliverable form — content + skeleton files.** Every file in the
   blueprint is created now as a skeleton (title + table of contents
   headers, no body content) so the doc tree exists as scaffolding for the
   team to fill in during implementation. `CLAUDE.md` is the one exception:
   it is written with full production-ready content immediately, since
   agents need it operational from the first line of service code.
3. **Scope — not limited to the original 11 files.** The original request
   listed 11 files across 4 categories. Six more files are added where a
   production-grade repo needs them for cross-cutting concerns the original
   list didn't cover (API/error conventions, subscription entitlements,
   testing strategy, CI/CD & environments, security/observability, and a
   human onboarding guide). Total: **17 files**.

## Master File List

### 1. Architecture (`docs/architecture/`)
- `monorepo-structure.md` — Nx workspace layout, `libs/shared/*` boundaries, dependency-graph tag rules.
- `microservices-http.md` — HTTP transport topology, `x-tenant-id`/Bearer propagation, API Gateway routing.
- `multi-tenancy-betterauth.md` — BetterAuth in `parishbooks-auth-svc`, tenant context resolution, TypeORM repository scoping.
- `api-conventions-error-handling.md` *(added)* — DTO/validation, error shape, pagination, idempotency-key rules.
- `subscription-entitlements.md` *(added)* — Plan → feature matrix, entitlement guards, grace-period behavior.

### 2. Feature Specs (`docs/specs/`)
- `typeorm-database-schema.md` — Core entities, `@Index(['organizationId','id'])` convention, migration workflow.
- `double-entry-ledger.md` — Debit/credit invariant, chart of accounts, append-only posting rules.
- `mobile-giving-app.md` — Expo app layout, biometrics, Cashfree mobile SDK, giving history.
- `crm-family-units.md` — Family/member model, ward/prayer-cell mapping, census tracking.

### 3. Payments & Compliance (`docs/integrations/`, `docs/compliance/`)
- `cashfree-giving-split.md` — Easy Split vendor onboarding, webhook processing, receipt trigger.
- `stripe-saas-billing.md` — Subscription tiers, billing webhooks, grace period, Cashfree Subscriptions parity.
- `tax-receipts-80g-501c3.md` — India-first 80G/PAN/FCRA rules; US 501(c)(3) as Phase 2 addendum.

### 4. Quality & Operations (`docs/quality-ops/`) *(added category)*
- `testing-strategy.md` *(added)* — Test pyramid, ledger invariant tests, Nx affected test runs.
- `ci-cd-environments.md` *(added)* — Pipeline stages, env promotion, migration gating, secrets.
- `security-observability.md` *(added)* — Tenant-isolation threat model, webhook secret rotation, structured logging.

### 5. Developer Experience (repo root, `docs/dx/`)
- `CLAUDE.md` — Full production content, written now (see repo root).
- `getting-started.md` *(added)* — Local setup, running services, seeding tenant data.

## Out of Scope

- Actual body content for files other than `CLAUDE.md` — those are skeletons only, filled in as each subsystem is implemented.
- Any code, library, or app scaffolding — this task is documentation only.
- US 501(c)(3) full implementation detail — placeholder/addendum only until Phase 2 is scheduled.

## Next Steps

Skeleton files and `CLAUDE.md` are created directly following this design
(no separate implementation plan needed — this is a documentation
deliverable, not code requiring TDD).
