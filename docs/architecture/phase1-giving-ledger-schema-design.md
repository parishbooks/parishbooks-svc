# Design: Phase 1 Remaining Schema — Giving, Ledger, Receipts

> Companion to `docs/roadmap.md` and `docs/specs/typeorm-database-schema.md`.
> This doc records the schema decisions needed to close the gap between
> that spec and what Phase 1's remaining build targets
> (`parishbooks-giving-svc`, `parishbooks-ledger-svc`) actually require.
> Entities described here are implemented in `packages/database/src/lib/entities/`.

## Problem

Per `docs/roadmap.md`, `parishbooks-giving-svc` and `parishbooks-ledger-svc`
are scaffold-only — the main Phase 1 build targets. The entities they need
(`Fund`, `Account`, `Donation`, `JournalEntry`, `JournalLine`, `Receipt`)
were specced in `docs/specs/typeorm-database-schema.md`, but that spec had
gaps the actual build hits immediately: no `Donation.status` state machine,
no idempotency-key column despite `docs/specs/mobile-giving-app.md` §4
requiring one, no vendor-KYC columns on `OrganizationProfile` despite
`docs/integrations/cashfree-giving-split.md` §1 requiring them, and no
`processed_webhook_events` table despite CLAUDE.md rule 5 and the Cashfree
doc §3 requiring one. `Member`/`Family` also weren't built yet, and Phase 1
needs a *minimal* slice of them (donor identity for receipting), not the
full CRM.

This design closes those gaps: the concrete entity list, columns, and
migration order for everything needed to hit the Definition of Done in
`docs/roadmap.md` §5.

## Requirements

**Functional**

- A donation survives a dropped connection: client retries with the same
  idempotency key return the same `Donation` row, never a duplicate.
- A webhook retried by Cashfree N times posts the ledger entry and
  completes the donation exactly once.
- Every donation is fund-tagged at creation and, if from a foreign source,
  rejected unless the fund is FCRA-eligible and the org is
  FCRA-registered — checked before order creation, not after.
- An org cannot receive donations until Cashfree vendor KYC is `ACTIVE`.
- Every `JournalEntry` balances (`SUM(debit) == SUM(credit)`) inside the
  same transaction that creates it.
- Receipts get a sequential number per `(organizationId, financialYear)`,
  India FY (Apr–Mar).

**Non-functional**

- Donation and ledger writes are one `QueryRunner` transaction — no
  partial state on crash mid-write (CLAUDE.md, "Transactions" rule).
- All tenant-scoped tables indexed on `(organizationId, id)` per existing
  convention — point lookups and list queries never full-scan.
- Webhook processing must be safe under Cashfree's documented retry
  behavior (duplicate delivery assumed, ordering not assumed).

## Proposed Design

```
Congregant App / Back-office
        │  POST /donations (idempotency key)
        ▼
parishbooks-giving-svc ──creates──▶ Donation(status=pending)
        │  creates Cashfree order (with vendor split)
        ▼
   Cashfree Easy Split
        │  PAYMENT_SUCCESS webhook (signed)
        ▼
parishbooks-giving-svc webhook handler
        │  1. verify signature
        │  2. INSERT processed_webhook_event (unique on provider+eventId) — dedupe gate
        │  3. tx: Donation.status → completed
        │        LedgerService.postEntry() → JournalEntry + 2 JournalLines
        │        Donation.journalEntryId = entry.id
        │  4. ack Cashfree
        ▼
   (async, queued, off the webhook path)
ReceiptService → Receipt (sequential number, fcraFlag snapshot, PDF, QR token)
```

`parishbooks-ledger-svc` owns `LedgerService.postEntry()` as the only
write path into `JournalEntry`/`JournalLine`; `parishbooks-giving-svc`
calls it in-process today, since ledger-svc is scaffold-only and there's
no message broker (see "Alternatives" for how this becomes a real service
boundary later without a schema change).

## Data Model

### Gaps closed in existing entities

**`OrganizationProfile`** — added vendor KYC columns
(`docs/integrations/cashfree-giving-split.md` §1):

| Column                   | Type                                              | Notes                                              |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `cashfreeVendorId`        | text, nullable                                      | Set once vendor onboarding succeeds                 |
| `cashfreeVendorStatus`    | enum(`not_started`,`pending`,`active`,`rejected`)   | Default `not_started`; Give flow gates on `active`  |
| `cashfreeVendorStatusAt`  | timestamptz, nullable                               | Last status transition, for support/debug           |

**`Donation`** — the original spec table was missing the state machine and
idempotency key that `docs/specs/mobile-giving-app.md` §4 requires:

| Column           | Type                                              | Notes                                                                                          |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `status`           | enum(`pending`,`processing`,`completed`,`failed`)   | `pending` at creation; terminal states set only by the webhook handler                             |
| `idempotencyKey`   | text                                                | Client-generated per attempt; unique per `(organizationId, idempotencyKey)`                        |
| `cashfreeOrderId`  | text, nullable                                      | Set once the order is created; distinct from `providerPaymentId` (set on completion)               |
| `failureReason`    | text, nullable                                      | Set on `failed`, for support/debugging                                                             |

`journalEntryId` and `providerPaymentId` are nullable until the donation
completes — the original spec showed `journalEntryId` as non-nullable,
which can't hold for a `pending` row.

### New tables

**`ProcessedWebhookEvent`** (shared across Cashfree and Stripe, per
`docs/integrations/cashfree-giving-split.md` §3):

| Column        | Type                       | Notes                     |
| ------------- | --------------------------- | ---------------------------- |
| `provider`    | enum(`cashfree`,`stripe`)   |                              |
| `eventId`     | text                         | Provider's event id         |
| `eventType`   | text                         |                              |
| `processedAt` | timestamptz                 |                              |

Unique on `(provider, eventId)`. **Not** tenant-scoped (extends
`BaseEntity`, not `TenantEntity`) — a webhook event isn't owned by one org
in a way that's known before the payload is parsed, and dedupe must work
before any tenant context is established. This is a deliberate, single
documented exception to CLAUDE.md rule 1 ("every tenant-scoped table...").

**`Family`** (minimal, per roadmap §2 — no household UI, just enough to
attribute a donation): `id`, `organizationId`, `name`, `address` (jsonb).

**`Member`** (minimal — donor identity only, not the CRM spec's full
column set): `id`, `organizationId`, `familyId` (nullable), `firstName`,
`lastName`, `email`, `phone`, `panNumber`, `betterAuthUserId`.

Deliberately **excludes** `membershipStatus`, `wardId`, `prayerCellId`,
`dob` — those are CRM-phase columns (`docs/specs/crm-family-units.md`)
that don't exist yet and aren't needed to attribute a donation. Adding
them now would mean `parishbooks-member-svc` inherits a half-built schema
when its phase actually starts, rather than a clean one.

`Fund`, `Account`, `JournalEntry`, `JournalLine`, `Receipt` were built as
specced in `docs/specs/typeorm-database-schema.md`, with one addition:
`JournalLine` carries a Postgres `CHECK` constraint
(`(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)`) as the
DB-level backstop described in `docs/specs/double-entry-ledger.md` §1.

### Entity relationship (Phase 1 slice)

```
Organization (BetterAuth) 1──1 OrganizationProfile
        │
        ├──* Family ──* Member ──* Donation
        │                              │  fundId, accountId
        ├──* Fund ─────────────────────┤
        ├──* Account ──self-FK (parentAccountId)
        │      ▲                        │
        │      │ accountId              │ journalEntryId (nullable until completed)
        │      │                        ▼
        └──* JournalEntry ──* JournalLine (accountId → Account)
                   │
                   └── Donation.journalEntryId (1:1 once posted)

Donation ──1:1── Receipt (fundFcraSnapshot copied from Fund at issue time)

ProcessedWebhookEvent — not tenant-scoped, keyed on (provider, eventId)
```

### Migration order (applied)

1. `AddCashfreeVendorFieldsToOrganizationProfile`
2. `CreateFamilyAndMember`
3. `CreateFund`
4. `CreateAccount`
5. `CreateJournalEntryAndJournalLine`
6. `CreateDonation`
7. `CreateReceipt`
8. `CreateProcessedWebhookEvent`

Each was generated from the entity diff and run against the local
Postgres instance before the next entity was added, so every migration is
scoped to one logical schema change per the convention in
`docs/specs/typeorm-database-schema.md` §3.

Not included in this pass: seeding each org's default chart of accounts
(`docs/specs/double-entry-ledger.md` §2) — that's application logic run
inside the `OrganizationProfile` creation transaction, not a schema
migration.

## Alternatives Considered

- **Call `LedgerService.postEntry()` over HTTP from giving-svc to a real
  ledger-svc process, now.** Rejected for Phase 1: adds a network hop and
  partial-failure surface to the hottest transactional path (donation
  completion) for a service boundary that doesn't buy anything yet —
  there's no second caller of `postEntry()` until billing/payroll phases
  exist. Keep it in-process (same Postgres transaction, imported as a
  library) for now; the schema doesn't change either way, so this is
  purely a later refactor, not a migration risk.
- **Skip `Donation.status` and infer state from `journalEntryId IS NULL`.**
  Rejected — collapses `pending`, `processing`, and `failed` into one NULL
  state, which breaks Giving History's "Processing" vs. "Failed"
  distinction required by `docs/specs/mobile-giving-app.md` §1/§4.
- **Make `Member`/`Family` full CRM entities now** to avoid a second
  migration later. Rejected per roadmap §3 — building CRM columns before
  the CRM phase starts risks designing them wrong without real usage.

## Trade-offs and Risks

- **`ProcessedWebhookEvent` not tenant-scoped** is an explicit exception
  to CLAUDE.md rule 1; flagged in the entity's own doc comment so it
  isn't mistaken for an oversight in review.
- **In-process ledger posting** means `parishbooks-ledger-svc` as a
  *deployed service* stays a scaffold through all of Phase 1 — it's
  really a library today. If another team starts treating the scaffold
  as production-ready and deploys it standalone, giving-svc and
  ledger-svc will drift.
- **Minimal `Member`** risks a follow-up migration when CRM phase adds
  `membershipStatus`/`wardId`/etc. — acceptable, since those are additive
  nullable columns, not a redesign of existing ones.

## Rollout Plan

1. Migrations 1–8 above — done (this doc).
2. `LedgerService.postEntry()` implementation + tests that fail on an
   unbalanced entry (satisfies `docs/quality-ops/testing-strategy.md`
   bar).
3. `parishbooks-giving-svc`: donation creation (idempotency-key-protected)
   → Cashfree order creation → webhook handler (dedupe → complete → post
   ledger entry, one transaction).
4. `ReceiptService` as an async job off the webhook path.
5. Back-office give-flow read views, then congregant app give-flow — both
   are pure consumers of the schema above, no further migrations expected
   from them.
