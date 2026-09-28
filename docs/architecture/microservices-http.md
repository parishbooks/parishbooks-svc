# Microservices — HTTP Transport Topology

> How ParishBooks NestJS services communicate over HTTP, and how Kong plus the back-office BFF expose them.

## Table of Contents

1. Service Map
2. Header Propagation (`x-tenant-id`, Bearer Token)
3. Kong, BFF, and Service Auth
4. Retry, Timeout, and Circuit-Breaker Policy
5. Service-to-Service Authentication

## 1. Service Map

**North–south (browser / providers):**

- **Kong** — TLS termination, routing, rate limits, correlation IDs. See
  `docs/architecture/kong-routing.md` for the route table.
- **`parishbooks-backoffice`** (separate repo) — Next.js App Router UI.
  Browser code talks only to same-origin **`/api/*`** route handlers (BFF).
- **Provider webhooks** — Cashfree, Stripe, etc. hit Kong on dedicated
  paths and land on the owning service (signature-verified, idempotent).

**East–west (BFF and services):**

Kong’s internal listener (or cluster DNS in production) forwards to:

`parishbooks-auth-svc`, `parishbooks-org-svc`, `parishbooks-member-svc`,
`parishbooks-ledger-svc`, `parishbooks-giving-svc`, `parishbooks-billing-svc`,
`parishbooks-events-svc`.

All services share **one** Postgres database via the single TypeORM
`DataSource` (`docs/specs/typeorm-database-schema.md`) — a modular
monolith on a shared schema with a service-oriented _API_ surface.

## 2. Header Propagation

- The back-office BFF resolves the caller’s session (JWT in an httpOnly
  cookie), verifies it when needed, and on upstream calls sets
  `x-tenant-id` from `activeOrganizationId` while forwarding the Bearer
  token unchanged.
- For **auth-svc identity routes** with a client JWT, the BFF also sets
  `x-session-token` from the JWT payload (same contract as the former
  gateway auth proxy) so Better Auth can accept the request.
- `packages/core`’s `HttpClientService` attaches propagation headers on
  service-to-service calls — individual services do not hand-roll forwarding.

**Tenant rule (unchanged):** services never trust `organizationId` from a
request body — only from the verified session / `x-tenant-id` set by a
trusted caller.

## 3. Kong, BFF, and Service Auth

| Layer | Responsibility |
| ----- | ---------------- |
| Kong | Route by path/host; optional edge plugins; **not** the identity trust boundary |
| Back-office `/api` BFF | Same-origin API for the UI; proxy to Kong; session cookie → Bearer; tenant header injection |
| Each Nest service | `AuthGuard` from `@parishbooks/core` (JWKS + session status); business logic |

- BFF aggregation (dashboards that merge JSON from N services) lives in
  **`parishbooks-backoffice`**, not in Kong.
- Better Auth browser flows (`/api/auth/*` — OAuth callbacks, JWKS) may
  be routed **publicly** through Kong to `auth-svc` so redirects and
  cookies work; curated identity APIs use `/api/identity/*`.

## 4. Retry, Timeout, and Circuit-Breaker Policy

- Idempotent `GET` calls retry with exponential backoff, max 2 retries.
- `POST`/`PUT` calls are **never** auto-retried by the HTTP client —
  retry safety on mutating calls is the idempotency-key mechanism's job
  (`docs/architecture/api-conventions-error-handling.md`).
- Default per-call timeout: 5 seconds.
- Circuit breaker policy applies to BFF and inter-service HTTP clients
  as documented in quality-ops when implemented.

## 5. Service-to-Service Authentication

- Calls without an end-user Bearer token use the shared
  `INTERNAL_SERVICE_KEY` header and `InternalServiceGuard` on internal
  routes (e.g. session status, billing sync).
- `InternalAuthGuard` is separate from user-facing `AuthGuard` so the
  two trust boundaries cannot be confused.
