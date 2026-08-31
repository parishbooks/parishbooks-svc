# Cashfree Easy Split — Giving Integration

> Vendor (church) onboarding, split-rule configuration, and webhook processing for donations via Cashfree Easy Split.

## Table of Contents

1. Vendor (Church) Onboarding & KYC Flow
2. Split Rule Configuration (Platform Commission %)
3. Webhook Signature Verification & Idempotent Processing
4. Donation Receipt Generation Trigger

## 1. Vendor (Church) Onboarding & KYC Flow

- During org signup/settings, the church submits Cashfree Easy Split
  vendor KYC (PAN, bank account, optional GSTIN) from the back-office.
- `parishbooks-billing-svc` (or `parishbooks-giving-svc`) calls
  Cashfree's Vendor API; the returned `vendorId` and vendor status are
  stored on `OrganizationProfile`.
- An org **cannot accept donations** until vendor status is `ACTIVE` —
  the Give flow (mobile app and any public giving page) checks this
  before allowing a donation to be created, not just before payout.

## 2. Split Rule Configuration

- Platform commission % is a **centrally configured** value keyed by
  `OrganizationProfile.planTier` (e.g. a lower rate on the $149/mo tier)
  — never set per-org by the church itself, to keep monetization policy
  in one place (see `docs/architecture/subscription-entitlements.md`).
- At order-creation time, the giving service computes the split (church
  vendor receives `amount − commission`, the platform's own Cashfree
  account receives the commission) and passes `split_details` on the
  Cashfree order-create call — the split is enforced by Cashfree at
  settlement, not reconciled after the fact.

## 3. Webhook Signature Verification & Idempotent Processing

- Cashfree signs webhooks with `x-webhook-signature` (HMAC over the raw
  body using the webhook secret). The handler recomputes the HMAC and
  rejects on mismatch — this runs before any parsing of the payload as
  trusted data.
- Every processed webhook is recorded in a shared
  `processed_webhook_events` table (`provider`, `eventId`, `eventType`,
  `processedAt`, unique on `(provider, eventId)`) — the same table used
  by Stripe webhooks (`docs/integrations/stripe-saas-billing.md`). A
  replayed event is a no-op after the first successful processing.
- The webhook secret rotation procedure lives in
  `docs/quality-ops/security-observability.md`.

## 4. Donation Receipt Generation Trigger

1. `PAYMENT_SUCCESS` webhook arrives, passes signature check and dedupe.
2. `Donation.status` → `completed`; `LedgerService.postEntry()` runs
   inside the same transaction (see
   `docs/specs/typeorm-database-schema.md` §4).
3. The webhook handler **acknowledges Cashfree immediately** after the
   transaction commits — it does not wait for receipt generation.
4. `ReceiptService` is triggered asynchronously (queued job, not inline)
   to render the 80G PDF, assign the sequential `receiptNumber`, and
   snapshot `Fund.fcraFlag` onto `Receipt.fundFcraSnapshot` (see
   `docs/compliance/tax-receipts-80g-501c3.md`). Keeping this off the
   webhook request path avoids Cashfree webhook timeouts on slow PDF
   rendering.
