# Monorepo Structure

> Nx workspace setup, library boundaries, and dependency-graph rules for the ParishBooks monorepo.

## Table of Contents

1. Workspace Layout
2. Apps vs. Libs Conventions
3. Library Boundaries (`libs/shared/typeorm`, `libs/shared/guards`, `libs/shared/common`)
4. Dependency Graph & Tag-Based Boundary Enforcement
5. Codegen & Scaffolding Commands

## 1. Workspace Layout

```
apps/
  parishbooks-auth-svc/       # BetterAuth, sessions, org switching (exists today)
  parishbooks-gateway/        # public entrypoint, header propagation, BFF aggregation
  parishbooks-crm-svc/        # Family, Member, Ward, Prayer Cell
  parishbooks-ledger-svc/     # Account, JournalEntry, JournalLine, Fund
  parishbooks-giving-svc/     # Donation, Cashfree Easy Split
  parishbooks-billing-svc/    # Stripe + Cashfree Subscriptions
  parishbooks-web/            # Next.js 14 back-office
  parishbooks-*-svc-e2e/      # one e2e project per service (Nx default)
libs/
  shared/typeorm/             # TenantEntity, TenantScopedRepository, DataSource, migrations
  shared/guards/              # TenantGuard, EntitlementGuard, AuthGuard, InternalAuthGuard
  shared/common/              # DTOs, shared exception filter, HTTP client, constants
  shared/betterauth-typeorm-adapter/  # custom BetterAuth Adapter (see multi-tenancy-betterauth.md)
```

The congregant mobile app (`React Native + Expo`) may live in `apps/` if
it shares the Nx toolchain cleanly, or in a separate repo if the Expo
build tooling fights Nx's — decide this when the app is actually
scaffolded, not preemptively here.

## 2. Apps vs. Libs Conventions

- **Apps** contain only bootstrap and wiring: `main.ts`, module
  composition, and thin controllers that delegate to services from
  `libs/`. An app should be deletable and rebuildable from its libs
  without losing business logic.
- **Libs** hold everything testable in isolation: services, entities,
  guards, DTOs. This is what makes `nx affected` meaningful — logic
  changes show up as affected libs with clear test boundaries, not as
  "the whole app changed."

## 3. Library Boundaries

| Library | Owns |
|---|---|
| `libs/shared/typeorm` | `TenantEntity` base class, all domain entities, `TenantScopedRepository`, the single `DataSource`, migrations |
| `libs/shared/guards` | `TenantGuard`, `EntitlementGuard`, `AuthGuard`, `InternalAuthGuard` |
| `libs/shared/common` | Shared DTOs, the exception filter (`docs/architecture/api-conventions-error-handling.md`), the internal service-to-service HTTP client |
| `libs/shared/betterauth-typeorm-adapter` | The custom BetterAuth `Adapter` implementation — used only by `parishbooks-auth-svc` |

## 4. Dependency Graph & Tag-Based Boundary Enforcement

- Every project gets Nx tags: `scope:shared` vs. `scope:<service-name>`,
  and `type:app` / `type:feature` / `type:data-access` / `type:util`.
- `@nx/eslint-plugin`'s module-boundaries rule enforces:
  - `type:app` may depend on anything under `scope:shared`.
  - `scope:shared` libs may never depend on any `type:app`.
  - `type:util` (e.g. `shared/common`) may not depend on `type:feature`
    libs — dependencies only flow util → data-access → feature → app.
- Enforced in CI via `nx affected -t lint` (`docs/quality-ops/ci-cd-environments.md`)
  — a boundary violation fails the build, it isn't just a warning.

## 5. Codegen & Scaffolding Commands

```bash
npx nx g @nx/nest:app parishbooks-x-svc
npx nx g @nx/js:lib shared/x --directory=libs/shared/x
npx nx g @nx/nest:resource --project=parishbooks-x-svc  # controller+service+module scaffold
```

A custom generator for "new tenant-scoped entity" (wiring up
`TenantEntity`, the `@Index(['organizationId','id'])` convention, and a
`TenantScopedRepository` in one step) is worth adding once the third or
fourth entity is hand-written the same way — not before.
