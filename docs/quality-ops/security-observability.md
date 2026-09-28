# Security & Observability

> Cross-cutting security and operational visibility rules for ParishBooks services.

## Table of Contents

1. Tenant Isolation Threat Model
2. Webhook Secret Rotation (Cashfree/Stripe)
3. Structured Logging & Correlation IDs Across HTTP Hops
4. PII & Financial Data Handling Rules

## 1. Tenant Isolation Threat Model

The single biggest risk in a shared-database multi-tenant platform is
cross-tenant data leakage via a missing `organizationId` filter. Layered
mitigations:

- `TenantScopedRepository` auto-injects `organizationId` into every
  query and refuses to run outside a resolved tenant context
  (`docs/architecture/multi-tenancy-betterauth.md` §4) — the default is
  "can't query without a tenant," not "must remember to filter."
- `TenantGuard` cross-checks the `x-tenant-id` header against the
  caller's actual session/membership, so a compromised or buggy upstream
  service can't forge a different tenant.
- Code review checklist item + periodic grep audit for any direct
  `@InjectRepository()` usage on a tenant entity, which would bypass the
  wrapper.

## 2. Webhook Secret Rotation

- Cashfree and Stripe webhook signing secrets live in the environment
  secrets store, rotated quarterly or immediately on suspected
  compromise.
- Handlers accept **two active secrets** during a rotation window (old +
  new) so rotation never causes a dropped webhook — this is what makes
  rotation safe to do without a maintenance window.

## 3. Structured Logging & Correlation IDs Across HTTP Hops

- A `correlationId` is generated once, at Kong (`correlation-id` plugin,
  header `X-Transaction-Id`), for every inbound request, and propagated
  as that same header on every downstream service-to-service call (same
  propagation mechanism as `x-tenant-id`,
  `docs/architecture/microservices-http.md` §2).
  See `docs/architecture/kong-routing.md` for the edge plugin table.
- Every log line and every error response
  (`docs/architecture/api-conventions-error-handling.md` §2) includes the
  `correlationId`, so a single user-reported error can be traced across
  every service it touched.
- Logs are structured JSON, shipped to a central log store. Financial
  mutation events (donation creation, ledger posting, subscription
  change) are tagged for longer retention than general request logs.

## 4. PII & Financial Data Handling Rules

- PAN numbers and any payment instrument details are never logged in
  full — masked (e.g. last 4 characters) wherever they'd otherwise appear
  in logs.
- Raw Cashfree/Stripe API keys are scoped to the billing and giving
  services only — the gateway and other services never hold live payment
  provider credentials.
- Database backups are encrypted at rest, consistent with holding both
  donor PII and financial ledger data in the same database.
