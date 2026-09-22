# Vendor Onboarding (KYC) — org-svc Design

> Design for how a church org submits payment-provider KYC and reaches
> `ACTIVE` vendor status, gating the Give flow, owned by
> `parishbooks-org-svc`. Endpoint and entity names are kept
> provider-agnostic — the payment provider is Cashfree today, but nothing
> in the API surface or schema says so.

## Table of Contents

1. Problem
2. Requirements
3. Proposed Design
4. Data Model
5. Alternatives Considered
6. Trade-offs and Risks
7. Rollout Plan

## 1. Problem

A church org cannot accept donations until the payment provider has
approved it as a vendor — this is Definition-of-Done blocker #1 in
`docs/roadmap.md`. Today `OrganizationProfile` already has
provider-status columns (`cashfreeVendorId`, `cashfreeVendorStatus`,
`cashfreeVendorStatusAt`, migration `1790088080236`) — named for the
concrete provider since they map directly to Cashfree's own vendor
object — but nothing yet exists to:

- collect KYC inputs (PAN, bank account, optional GSTIN) from a church
  admin through a **generic onboarding endpoint**, not a
  provider-named one,
- call the payment provider's Vendor API to create/update the vendor,
- keep vendor status in sync as the provider reviews the submission
  asynchronously,
- gate the Give flow on vendor status being `ACTIVE`.

Keeping the public API and request/response shapes provider-agnostic
("onboarding", not "cashfree-vendor") means swapping or adding a second
payment provider later doesn't require a breaking API change — only the
internal client implementation changes.

## 2. Requirements

**Functional**
- Back-office admin submits onboarding KYC (PAN, bank account number +
  IFSC, optional GSTIN, business name/type) for their org via a generic
  `.../onboarding` route.
- System calls the payment provider's Vendor API to create or update the
  vendor, persists the provider's vendor id.
- System reflects the provider's KYC decision (`pending` → `active` |
  `rejected`) on `OrganizationProfile`, including a rejection reason the
  admin can act on.
- Give flow (`parishbooks-giving-svc`) can cheaply check "is this org's
  onboarding ACTIVE" before creating a donation order
  (`docs/integrations/cashfree-giving-split.md` §1).
- Admin can resubmit after a rejection.

**Non-functional**
- Provider KYC review is **asynchronous** (minutes to days) — no
  synchronous wait in the request path.
- PAN and bank account details are sensitive: never logged in full
  (`docs/quality-ops/security-observability.md` §4), masked in any API
  response back to the back-office.
- Low volume (onboarding is a one-time-per-org, admin-driven action, not
  a hot path) — correctness and auditability matter more than
  throughput.
- Must respect the "migrations only" and "tenant-scoped query"
  non-negotiables in `CLAUDE.md`.
- The external payment-provider identity (Cashfree today) stays an
  internal implementation detail of org-svc — never leaks into route
  paths, DTO field names as first-class concepts, or response shapes
  consumed by other services.

## 3. Proposed Design

```
Back-office (Next.js)
   │  POST /organizations/:orgId/onboarding   (KYC form)
   ▼
parishbooks-gateway-svc  ── forwards x-tenant-id + Bearer token ──▶
   │
   ▼
parishbooks-org-svc
   ├─ OrganizationOnboardingController  (new sub-route on the existing
   │    organization-profile module)
   ├─ OnboardingService
   │    1. validate org doesn't already have an ACTIVE vendor
   │    2. call VendorProvider.createOrUpdateVendor(...)
   │    3. persist provider vendor id + status=PENDING, in the same
   │       queryRunner transaction as writing the submission audit row
   ├─ VendorProvider (abstract class) / CashfreeVendorProvider (impl)
   │    - abstract class declaring the provider-agnostic contract
   │      (createOrUpdateVendor, getVendorStatus, verifyWebhookSignature,
   │      parseWebhookEvent) that CashfreeVendorProvider extends
   │      `VendorProvider implements ...`-style, so OnboardingService
   │      depends only on the abstract type and the concrete provider is
   │      swappable without touching the controller/service/DTOs
   │    - an abstract class (not a bare interface) so shared,
   │      non-provider-specific behavior — e.g. masking PAN/bank account
   │      before they're ever handed to a concrete client, or the
   │      retry/timeout wrapping every provider call needs per
   │      docs/architecture/microservices-http.md §4 — lives once in the
   │      base class instead of being duplicated in every provider impl
   │    - holds the live provider API key (org-svc is one of the
   │      services scoped to hold it, alongside giving-svc, per
   │      docs/quality-ops/security-observability.md §4)
   └─ OrganizationOnboardingWebhookController  (new)
        - provider KYC-status webhook → verify signature → dedupe via
          processed_webhook_events (provider='cashfree' internally) →
          update vendor status / status timestamp
```

Status reconciliation is **webhook-driven, not polled**: the provider
sends vendor KYC status webhooks the same way it sends payment webhooks,
so this reuses the exact verify → dedupe → apply pattern already
specified for donations (`docs/integrations/cashfree-giving-split.md`
§3) instead of introducing a new polling job. A daily reconciliation job
(plain `nx` cron target hitting the provider's GET-vendor endpoint) is a
fallback safety net for orgs stuck in `pending` past a threshold — not
the primary mechanism.

`parishbooks-giving-svc` checks onboarding status via a normal
service-to-service call to org-svc (`GET
/organizations/:orgId/onboarding/status`, internal-auth or user-token
forwarded per `docs/architecture/microservices-http.md` §2) at
donation-creation time — no cross-service DB join, since services only
own their own entities even on the shared DataSource.

## 4. Data Model

Extend `OrganizationProfile` (already has the three provider-status
columns) with a KYC *submission* record, kept in its own table rather
than more columns on `organization_profile` — it needs a history
(resubmission after rejection) that a single-row profile can't hold
cleanly:

```
OrganizationOnboardingSubmission (new entity, new migration)
  id                  uuid PK
  organizationId      uuid            -- indexed with id per CLAUDE.md rule 1
  panNumberMasked     text            -- last-4 only, e.g. "XXXXX1234F" style mask
  bankAccountMasked   text            -- last-4 only
  ifsc                text
  gstin               text nullable
  businessName        text
  submittedByUserId   uuid
  providerRawStatus   text            -- provider's own status string, for debugging
  createdAt           timestamptz
```

Raw PAN and full bank account number are **not persisted** in
ParishBooks' database at all — they're passed straight through to the
provider's Vendor API call and only the masked form is stored for the
admin-facing "what did we submit" view. This avoids ParishBooks becoming
a second store of regulated financial PII beyond what's operationally
necessary, and sidesteps an encryption-at-rest-for-PAN design question
entirely.

`OrganizationProfile`'s existing vendor-status columns stay the single
source of truth the Give flow checks — `OrganizationOnboardingSubmission`
is an audit/debugging trail, not something other services query. Field
and table names here are deliberately generic ("onboarding", "vendor
status") even though the columns they extend (`cashfreeVendorId`, etc.)
are already provider-named from an earlier design — this design doesn't
rename those existing columns, only avoids adding new provider-named
surface area going forward.

## 5. Alternatives Considered

- **Name the endpoint/entity after the provider (`.../cashfree-vendor`)**
  — matches the existing column names exactly and is marginally more
  discoverable to a developer who already knows Cashfree is the
  provider. Rejected per explicit direction: the public API and new
  schema should read as "onboarding," not "Cashfree," so a second
  provider or a provider swap doesn't force a breaking route/entity
  rename later.
- **Poll the provider instead of webhooks** — simpler to build (no new
  inbound endpoint), but means KYC approval can sit unreflected for up
  to a poll interval, and duplicates logic the codebase already has for
  payment webhooks. Rejected as primary mechanism; kept as a fallback
  reconciliation job only.
- **Store full PAN/bank account encrypted at rest** — would let the
  back-office show/edit full values without re-collecting them, but adds
  a KMS/encryption-key-management surface area for Phase 1 and expands
  the PII blast radius unnecessarily. Rejected — the provider already
  holds the source of truth for KYC data; we only need enough to display
  what was submitted.
- **Put onboarding in `parishbooks-billing-svc` instead of `org-svc`** —
  the integration doc mentions billing-svc as one option (§1:
  "billing-svc or giving-svc"). Rejected in favor of `org-svc`, matching
  `docs/roadmap.md`'s explicit assignment ("Organization profile
  (parishbooks-org-svc) — church record, Cashfree vendor KYC status")
  and keeping billing-svc untouched since it's out of Phase 1 scope
  entirely.
- **Synchronous KYC check inline on the vendor-create call** — the
  provider can return an immediate decision in some cases, but treating
  it as always-sync would require the request path to handle slow
  reviews too. Rejected; webhook-driven status is a single code path
  regardless of how fast the provider happens to respond.

## 6. Trade-offs and Risks

- **Webhook dependency**: if the provider's webhook delivery to us fails
  silently (not retried, or our endpoint down during the one delivery
  attempt), an org could sit in `pending` indefinitely with no automatic
  recovery — mitigated by the daily reconciliation job, but that's a
  real gap until it's built.
- **Masked-only storage** means if an admin needs to know exactly what
  bank account is on file, the back-office has to re-query the provider
  (via a thin proxy call) rather than reading our own DB — accepted
  trade-off for reduced PII footprint.
- **Generic naming vs. provider-specific columns**: the new
  `OrganizationOnboardingSubmission` table and API are provider-agnostic,
  but they still sit next to `OrganizationProfile.cashfreeVendorId` /
  `cashfreeVendorStatus`, which are not. This design accepts that
  inconsistency rather than renaming shipped, migrated columns as part
  of this work — a future pass can rename those to generic equivalents
  (with a migration) if/when a second provider is actually added.
- **Shared DataSource, service-owned tables**: `giving-svc` calling
  `org-svc` over HTTP for onboarding status (rather than reading
  `organization_profile` directly) adds one network hop to the hot
  donation-creation path. Given it's a single boolean-ish check and the
  5s timeout / circuit-breaker policy already exists
  (`docs/architecture/microservices-http.md` §4), this is acceptable; if
  it becomes a latency problem, revisit with a cached/pushed status
  instead of adding a cross-service DB read that breaks the ownership
  boundary.

## 7. Rollout Plan

1. Migration: add `OrganizationOnboardingSubmission` entity + table.
2. `VendorProvider` abstract class + `CashfreeVendorProvider`
   implementation (`class CashfreeVendorProvider extends
   VendorProvider`) in org-svc (or a shared
   `libs/shared/vendor-provider` if giving-svc's order-create client
   will duplicate auth/signing logic — check when giving-svc's Cashfree
   work starts, don't build it twice).
3. `POST /organizations/:orgId/onboarding` submission endpoint + service
   logic, behind the existing `TenantGuard`.
4. `OrganizationOnboardingWebhookController` — signature verification,
   dedupe via existing `processed_webhook_events`, status update.
5. `GET /organizations/:orgId/onboarding/status` internal-facing
   endpoint for giving-svc to consume.
6. Wire the Give flow's pre-donation check in giving-svc once
   giving-svc's donation-creation endpoint exists (sequencing
   dependency — this can land before that endpoint, giving-svc just
   won't call it yet).
7. Daily reconciliation cron as a follow-up hardening pass, not a launch
   blocker for the happy path.

Steps 1–5 are the Phase 1 blocking work; step 6 depends on giving-svc's
own build-out landing in parallel; step 7 can trail behind initial
launch.
