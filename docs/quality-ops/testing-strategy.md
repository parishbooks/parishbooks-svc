# Testing Strategy

> Test pyramid and conventions across the ParishBooks Nx monorepo.

## Table of Contents

1. Unit vs. Integration vs. E2E per Service
2. Ledger-Specific Invariant Tests
3. Nx `affected` Test Runs in CI
4. Test Database Strategy

## 1. Unit vs. Integration vs. E2E per Service

- **Unit** (`*.spec.ts`, colocated with source): pure logic with no DB —
  `LedgerService`'s balance-calculation helpers, the entitlement matrix
  lookup, DTO validation rules.
- **Integration** (per lib/service): hits a real Postgres test database
  through TypeORM. The DB is never mocked for repository/service
  integration tests — a mocked repository can't catch a missing
  `organizationId` filter or a broken migration, which are exactly the
  bugs that matter most here.
- **E2E** (`apps/*-e2e`): drives the running Nest app over real HTTP,
  exercising the full pipeline — guards, validation pipe, tenant
  scoping, error filter — not just the service method in isolation.

## 2. Ledger-Specific Invariant Tests

- Table-driven tests asserting `postEntry()` rejects every unbalanced
  line combination it's given (not just one example) —
  `docs/specs/double-entry-ledger.md` §1.
- A test asserting reversing entries never mutate the original
  `JournalEntry`/`JournalLine` rows (append-only, §3 of the ledger doc).
- A test asserting `TenantScopedRepository` throws
  `TenantContextMissingError` when called outside an
  `AsyncLocalStorage`-scoped request — this is the test that would catch
  a future cross-tenant leak at the repository layer before it ships.

## 3. Nx `affected` Test Runs in CI

```bash
npx nx affected -t lint test build e2e-ci --base=origin/main
```

CI always runs `affected` against the PR's base branch, never the full
project set — the workspace is expected to grow to many services, and a
full run on every PR doesn't scale. Local pre-push hooks mirror a
lighter subset (`lint test`, no `e2e-ci`) — full details in
`docs/quality-ops/ci-cd-environments.md`.

## 4. Test Database Strategy

- CI: a fresh Postgres instance per run (docker-compose/testcontainers),
  migrations applied via `migration:run` before tests execute, schema
  torn down after.
- Local: a dedicated `parishbooks_test` database — integration tests
  never point at the developer's own dev database, so a bad test can't
  corrupt local dev data.
