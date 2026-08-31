# API Conventions & Error Handling

> Cross-service REST conventions shared by every ParishBooks NestJS service.

## Table of Contents

1. DTO & Validation Pipe Standards
2. Error Response Shape & Error Codes
3. Pagination & Filtering Conventions
4. Idempotency-Key Rules for Payment-Adjacent Endpoints

## 1. DTO & Validation Pipe Standards

- Every controller input (body, query, params) is a `class-validator`
  DTO class — no untyped `@Body()`/`@Query()` reads.
- Global pipe on every service:
  ```ts
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  ```
- DTOs specific to one service live next to their controller; DTOs shared
  across services (e.g. `PaginationQueryDto`, `IdempotentRequestDto`)
  live in `libs/shared/common/dto`.

## 2. Error Response Shape & Error Codes

Every error response, from every service, is shaped by a shared exception
filter (`libs/shared/common`):

```json
{
  "statusCode": 422,
  "errorCode": "LEDGER_UNBALANCED_ENTRY",
  "message": "Journal entry debits and credits do not balance.",
  "details": { "expectedCredit": 5000, "actualCredit": 4900 },
  "correlationId": "c7e1..."
}
```

- `errorCode` is a stable, machine-readable string — clients branch on
  this, never on `message` (which is free text and may change).
- `correlationId` matches the request's structured log entry (see
  `docs/quality-ops/security-observability.md`), so a client-reported
  error can be traced straight to server-side logs.

## 3. Pagination & Filtering Conventions

- List endpoints use **cursor-based** pagination
  (`?cursor=<opaque>&limit=25`, max `limit=100`) rather than offset —
  stable results under concurrent writes to tenant data (e.g. new
  members/donations arriving while an admin pages through a list).
- Filtering is via explicit, typed query DTO fields
  (`?membershipStatus=active&wardId=...`) — no arbitrary raw filter
  objects passed through to the query layer.

## 4. Idempotency-Key Rules for Payment-Adjacent Endpoints

- Mutating `POST` endpoints on payment-adjacent paths (donation creation,
  subscription/plan changes) require an `Idempotency-Key` header.
- The server stores `(organizationId, endpoint, idempotencyKey) →
  response` for 24 hours. A repeated request with the same key returns
  the cached response instead of re-executing the mutation — this is
  what makes the mobile app's offline/retry behavior
  (`docs/specs/mobile-giving-app.md` §4) safe against double-submission.
- Idempotency keys are client-generated (UUID) at the point the user
  initiates the action, not per HTTP retry — a true resend of the same
  logical action reuses the same key.
