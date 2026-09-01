# Microservices — HTTP Transport Topology

> How ParishBooks NestJS services communicate over HTTP, and how the API Gateway routes and aggregates requests.

## Table of Contents

1. Service Map
2. Header Propagation (`x-tenant-id`, Bearer Token)
3. API Gateway Routing & Aggregation
4. Retry, Timeout, and Circuit-Breaker Policy
5. Service-to-Service Authentication

## 1. Service Map

`parishbooks-gateway` (public entrypoint) →
`parishbooks-auth-svc`, `parishbooks-crm-svc`, `parishbooks-ledger-svc`,
`parishbooks-giving-svc`, `parishbooks-billing-svc`.

All services share **one** Postgres database via the single TypeORM
`DataSource` (`docs/specs/typeorm-database-schema.md`) — this is a
modular monolith on a shared schema with a service-oriented _API_
surface, not physically isolated per-service databases. That's a
deliberate v1 simplification (it's what makes cross-entity transactions
like donation+ledger posting possible at all); revisit only if a service
needs independent scaling/deployment badly enough to justify the
distributed-transaction cost of splitting the database.

## 2. Header Propagation

- The gateway resolves the caller's session, reads
  `activeOrganizationId`, and sets `x-tenant-id` on every downstream
  call, forwarding the original Bearer token unmodified alongside it.
- `libs/shared/common`'s internal HTTP client attaches `x-tenant-id` and
  the Bearer token automatically on every outbound service-to-service
  call — individual services never hand-roll header forwarding, which is
  what makes rule 4 in `CLAUDE.md` actually hold across the whole
  codebase instead of being reimplemented (and potentially forgotten)
  per call site.

## 3. API Gateway Routing & Aggregation

- The gateway is a thin reverse proxy plus a BFF aggregation layer for
  back-office views that need data from more than one service in a
  single response (e.g. a dashboard combining CRM counts and ledger
  balances).
- It contains **no business logic** — aggregation is "call N services,
  merge JSON," not decision-making. Business rules live in the owning
  service.

## 4. Retry, Timeout, and Circuit-Breaker Policy

- Idempotent `GET` calls retry with exponential backoff, max 2 retries.
- `POST`/`PUT` calls are **never** auto-retried by the HTTP client —
  retry safety on mutating calls is the idempotency-key mechanism's job
  (`docs/architecture/api-conventions-error-handling.md`), not a
  transport-level concern.
- Default per-call timeout: 5 seconds.
- A circuit breaker trips after a configurable run of consecutive
  failures to a given downstream service, and fails fast rather than
  letting requests queue up behind a degraded dependency.

## 5. Service-to-Service Authentication

- Calls that aren't carrying an end-user's Bearer token (e.g. a
  scheduled job posting month-end ledger entries) use a short-lived
  internal JWT — a service identity, not a user identity — signed with a
  key rotated on the schedule in
  `docs/quality-ops/security-observability.md`.
- `InternalAuthGuard` verifies this token on any endpoint marked
  internal-only; it is a separate guard from the user-facing `AuthGuard`
  so the two trust boundaries can't be confused with each other.
