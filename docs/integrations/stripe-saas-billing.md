# Stripe SaaS Billing

> Platform subscription billing for churches ($49/mo, $149/mo tiers).

## Table of Contents

1. Tier Configuration
2. Webhook Handling (`customer.subscription.*` events)
3. Grace Period & Dunning
4. Cashfree Subscriptions Parity Notes

## 1. Tier Configuration

- Two Stripe Products/Prices: **Starter** ($49/mo), **Pro** ($149/mo).
  `OrganizationProfile.planTier` mirrors the active Price.
- A Stripe `Customer` is created at org signup (billing email/org name);
  a `Subscription` is created when the org picks a paid plan. Feature
  differences between tiers are documented in
  `docs/architecture/subscription-entitlements.md`, not here — this doc
  is billing mechanics only.

## 2. Webhook Handling

Handled entirely by BetterAuth's `stripe()` plugin, mounted on
`parishbooks-auth-svc` (`POST /api/auth/stripe/webhook`) — signature
verification, event parsing, and idempotency are the plugin's
responsibility, not a hand-rolled handler. The plugin's webhook switch
only special-cases `checkout.session.completed` and the three
`customer.subscription.*` events; `invoice.paid`/`invoice.payment_failed`
are not specially handled by this plugin version and fall through to a
generic `onEvent` callback this codebase does not currently use. The
`onSubscriptionUpdate`/`onSubscriptionDeleted` hooks push the resulting
`planTier`/`billingStatus` into `OrganizationProfile` via an internal
HTTP call to `parishbooks-org-svc`'s `PATCH
/organizations/:organizationId/billing-sync` endpoint, guarded by a
shared-secret `InternalServiceGuard` (see
`docs/superpowers/specs/2026-09-08-stripe-billing-integration-design.md`
for the full design). `parishbooks-billing-svc` has no role in Stripe
webhook handling.

| Event                                            | Effect                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `customer.subscription.created`                  | `billingStatus` → `active`; `planTier` set via `onSubscriptionUpdate`          |
| `customer.subscription.updated`                  | Plan tier / status change reflected via `onSubscriptionUpdate`                  |
| `customer.subscription.deleted`                  | `billingStatus` → `canceled` via `onSubscriptionDeleted`; org drops to read-only |

## 3. Grace Period & Dunning

- 7 days from `pastDue` before any feature restriction — the org keeps
  full entitlements for the grace window while Stripe's own retry/dunning
  emails run, plus an in-app banner and a ParishBooks reminder email.
- If the grace period expires without an `invoice.paid` event,
  `billingStatus` → `locked`. Locked orgs move to **read-only** (view
  existing data, cannot create new donations, members, or ledger
  entries) rather than a hard lockout — church financial/membership data
  is never held hostage behind a billing failure.
- `EntitlementGuard` checks `billingStatus` in addition to `planTier`
  (`docs/architecture/subscription-entitlements.md`).

## 4. Cashfree Subscriptions Parity Notes

- India-billed orgs may opt into **Cashfree Subscriptions** instead of
  Stripe, for UPI Autopay support that Stripe doesn't offer well in
  India. `OrganizationProfile.billingProvider` (`stripe` | `cashfree`)
  selects which provider's webhooks are authoritative for that org.
- Entitlement logic (`EntitlementGuard`) is provider-agnostic — it reads
  the locally synced `billingStatus`/`planTier` regardless of which
  provider wrote them, so the rest of the platform never branches on
  `billingProvider`.
- Cashfree Subscriptions webhook events map to the same
  `active`/`pastDue`/`locked`/`canceled` state machine as §2; the mapping
  table lives alongside the Cashfree Subscriptions webhook handler, kept
  in sync with this doc when Cashfree Subscriptions is implemented.
