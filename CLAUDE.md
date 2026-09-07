# CLAUDE.md

Operational guide for AI agents and developers working in the ParishBooks
Nx monorepo. Read this before writing any code. Detailed specs live under
`docs/` — this file is the map and the rules that don't fit in any one spec.

## What ParishBooks Is

A multi-tenant Church Management System (ChMS) and financial back-office
platform. Each tenant is an **Organization** (a church). The platform
combines a CRM (families/members), a double-entry accounting ledger,
donation collection (Cashfree), and SaaS subscription billing (Stripe +
Cashfree Subscriptions) behind a Next.js back-office and an Expo congregant
app.

Compliance scope is **India-first**: 80G tax receipts, PAN capture, and
FCRA fund segregation are launch-blocking. US 501(c)(3) support is a
documented Phase 2 addendum — see `docs/compliance/tax-receipts-80g-501c3.md`.

## Stack

| Layer                | Technology                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Monorepo tooling     | Nx 23.x, workspace name `parishbooks`, package manager `bun`                             |
| Services             | NestJS 11, HTTP transport (REST/JSON) — no message broker                                |
| Auth & multi-tenancy | BetterAuth, running inside `apps/parishbooks-auth-svc`                                   |
| Database             | PostgreSQL, TypeORM (entities, custom repositories, migrations)                          |
| Giving payments      | Cashfree PG + Cashfree Easy Split (UPI/Cards/NetBanking, marketplace commission splits)  |
| SaaS billing         | Stripe (primary) + Cashfree Subscriptions (India-billed orgs) — $49/mo and $149/mo tiers |
| Back-office web      | Next.js 14 App Router, Tailwind CSS, Shadcn UI                                           |
| Congregant app       | React Native + Expo (iOS/Android)                                                        |

## Repo Map

```
apps/
  parishbooks-auth-svc/       # BetterAuth, sessions, org switching (exists today)
  parishbooks-<name>-svc/     # future services follow the same -svc suffix
libs/
  shared/typeorm/             # base entities, tenant-scoped repository, migration config
  shared/guards/              # tenant guard, entitlement guard, auth guard
  shared/common/              # DTOs, error types, HTTP client for service-to-service calls
docs/
  architecture/                # monorepo, HTTP topology, multi-tenancy, API conventions, entitlements
  specs/                       # DB schema, ledger, mobile app, CRM
  integrations/                # Cashfree, Stripe
  compliance/                  # tax receipts (80G / 501c3)
  quality-ops/                 # testing, CI/CD, security
  dx/getting-started.md
```

New apps must follow the `parishbooks-<domain>-svc` naming convention
(matches the existing `parishbooks-auth-svc`). Shared code goes in
`libs/shared/*`, never copy-pasted between services — see
`docs/architecture/monorepo-structure.md` for boundary/tag rules before
adding a new lib.

## Commands

```bash
bun install                              # install deps (bun.lock is the lockfile)
npx nx serve parishbooks-auth-svc        # run a single service
npx nx affected -t lint test build       # CI-equivalent check on changed projects only
npx nx g @nx/nest:app parishbooks-x-svc  # scaffold a new NestJS HTTP service
npx nx g @nx/js:lib shared/x --directory=libs/shared/x  # scaffold a shared lib
```

Always prefer `nx affected` over running every project — this workspace
will grow to many services and full runs get slow fast.

## Non-Negotiable Rules

These are the rules most likely to cause a production incident if broken.
Full rationale is in the linked doc; the rule itself is enforced here.

1. **Every tenant-scoped table gets `@Index(['organizationId', 'id'])`,
   and every repository query filters by `organizationId`.** There is no
   default-deny row-level security at the DB layer yet — the application
   layer is the tenant boundary. Never write a query against Member,
   Family, Fund, Account, Donation, JournalEntry, or JournalLine without
   an explicit `organizationId` filter. See
   `docs/architecture/multi-tenancy-betterauth.md` and
   `docs/specs/typeorm-database-schema.md`.

2. **The ledger is append-only.** Never `UPDATE` or `DELETE` a
   `JournalEntry` or `JournalLine`. Corrections are reversing entries.
   Every entry must satisfy `SUM(debit) == SUM(credit)` before commit —
   enforce this in the service layer inside the same DB transaction that
   writes the lines, not as a post-hoc check. See
   `docs/specs/double-entry-ledger.md`.

3. **Migrations only — never `synchronize: true`.** All schema changes go
   through `typeorm migration:generate` → human review → committed
   migration file. `synchronize` must stay `false` in every environment
   including local dev, so migrations are actually exercised before prod.
   See `docs/specs/typeorm-database-schema.md`.

4. **Every inter-service HTTP call forwards `x-tenant-id` and the caller's
   Bearer token (or an internal service credential for
   system-to-system calls).** A service must never trust a tenant ID from
   a request body — only from the resolved session/header. See
   `docs/architecture/microservices-http.md`.

5. **All Cashfree and Stripe webhooks are signature-verified and processed
   idempotently** (dedupe on provider event ID before applying side
   effects). Webhook handlers must never trigger ledger writes or receipt
   generation twice for the same event. See
   `docs/integrations/cashfree-giving-split.md` and
   `docs/integrations/stripe-saas-billing.md`.

6. **Donations are fund-tagged at creation time, not retroactively.** FCRA
   segregation and 80G receipt correctness both depend on knowing the fund
   (foreign vs. domestic, restricted vs. general) at the moment money
   lands. See `docs/compliance/tax-receipts-80g-501c3.md`.

7. **Feature access is checked via the entitlement guard, not by
   inspecting plan strings inline.** Plan tier lives in one place; don't
   let `if (org.plan === 'pro')` checks spread across controllers. See
   `docs/architecture/subscription-entitlements.md`.

## Working Conventions

- **DTOs and validation**: every controller input is a class-validator DTO
  behind a global `ValidationPipe`. No untyped `Body()`/`Query()` reads.
  See `docs/architecture/api-conventions-error-handling.md`.
- **Error shape**: use the shared error filter from `libs/shared/common` —
  don't hand-roll error responses per service.
- **Transactions**: any write that touches more than one entity (e.g., a
  donation that also posts ledger lines) runs inside a single TypeORM
  `queryRunner` transaction. Partial writes on payment paths are the
  primary source of financial data corruption — treat this as a hard
  rule, not a style preference.
- **Secrets**: Cashfree and Stripe keys, BetterAuth secrets, and DB
  credentials come from environment variables, never committed, never
  logged. See `docs/quality-ops/security-observability.md`.
- **Repository/service boundary**: all TypeORM calls (`create`, `save`,
  `find*`, `update`, `delete`, query builders) live in a repository method.
  Services call named repository methods (e.g. `createProfile(...)`) and
  never touch `Repository`/`BaseRepository` methods directly — no
  `this.repository.create(...)` or `this.repository.save(...)` inline in a
  service. This keeps persistence logic (and future query optimization)
  in one place per entity instead of scattered across services.
- **Tests**: new business logic in the ledger, giving, or billing paths
  needs a test that would fail if the invariant it protects were broken
  (e.g., an unbalanced journal entry). See
  `docs/quality-ops/testing-strategy.md`.

## When You're Unsure

- Architecture/topology question → `docs/architecture/`
- "What fields does this entity need" → `docs/specs/typeorm-database-schema.md`
- "How does money move" → `docs/specs/double-entry-ledger.md` and the relevant `docs/integrations/*.md`
- "Is this compliant" → `docs/compliance/tax-receipts-80g-501c3.md`
- Local setup issues → `docs/dx/getting-started.md`

If a doc is still a skeleton (marked `_TODO_`) and you need the answer to
proceed, ask rather than guessing at a financial or compliance rule.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
