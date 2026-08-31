# CI/CD & Environments

> Pipeline stages, environment promotion, and migration gating for ParishBooks.

## Table of Contents

1. Nx Affected-Based CI
2. Environment Promotion (dev → staging → prod)
3. Migration Gating (No Auto-Apply in Prod)
4. Secrets Management per Service

## 1. Nx Affected-Based CI

- **On PR**: `nx affected -t lint test build` against the PR's base
  branch.
- **On merge to `main`**: `nx affected -t build`, Docker images built and
  pushed, automatic deploy to **staging**.
- **Promotion to production is a manual, explicit step** — never
  automatic on merge. A church-facing financial platform doesn't get
  auto-deployed to prod on every merge.

## 2. Environment Promotion

`local → staging → production`.

- **Staging** mirrors production topology (all services, one shared
  Postgres) but runs Cashfree and Stripe in **test mode** — no real
  money moves, no real webhook secrets shared with prod.
- **Production** uses live Cashfree/Stripe keys and a separate database
  from staging; nothing that touches production keys or the production
  DB runs outside the gated production deploy step.

## 3. Migration Gating

- Migrations run as their **own CI/CD job**, separate from the app
  deploy, and always run **before** the new app version is deployed —
  never after. Code should never ship expecting a column that hasn't
  been migrated in yet.
- Production migrations require manual approval, same as the production
  deploy itself.
- Rollback = revert the migration file and redeploy the previous app
  version. An already-applied migration is never hand-edited — a bad
  migration gets a new, corrective migration, consistent with the
  ledger's own "never edit history" principle
  (`docs/specs/double-entry-ledger.md`).

## 4. Secrets Management per Service

- Per-environment secrets store, injected as environment variables at
  deploy time — never baked into Docker images, never committed.
- Rotated on a defined schedule (Cashfree/Stripe webhook secrets,
  BetterAuth secret, DB credentials, internal service JWT signing key —
  see `docs/quality-ops/security-observability.md` for the rotation
  procedure itself).
- Staging and production secrets are fully separate values — a staging
  key leak can't be used against production.
