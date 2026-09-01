# Subscription Entitlements & Feature Gating

> How plan tier ($49/mo, $149/mo) controls feature access across services.

## Table of Contents

1. Plan → Feature Matrix
2. Entitlement Check Pattern (Guard/Decorator)
3. Grace-Period & Downgrade Behavior
4. Source of Truth: Stripe vs. Cashfree Subscriptions

## 1. Plan → Feature Matrix

Illustrative starting matrix — product-owner-confirmed limits are
tracked separately; the structure below (feature keys, not hardcoded
`if (plan === ...)` checks) is the part that's binding.

| Feature key              | Starter ($49/mo)  | Pro ($149/mo) |
| ------------------------ | ----------------- | ------------- |
| `crm.members`            | Up to 500 members | Unlimited     |
| `ledger.core`            | Included          | Included      |
| `giving.cashfree`        | Included          | Included      |
| `reporting.multi-fund`   | —                 | Included      |
| `compliance.fcra-module` | —                 | Included      |
| `support.priority`       | —                 | Included      |

## 2. Entitlement Check Pattern (Guard/Decorator)

```ts
@RequiresEntitlement('reporting.multi-fund')
@Get('reports/by-fund')
getFundReport() { /* ... */ }
```

- `EntitlementGuard` (`libs/shared/guards`) resolves the request's
  `organizationId` (from tenant context, §3 of
  `docs/architecture/multi-tenancy-betterauth.md`), looks up
  `OrganizationProfile.planTier` and `billingStatus`, and checks the
  decorator's feature key against the matrix in §1.
- The plan/billing lookup is cached with a short TTL (a few minutes) so
  entitlement checks don't add a DB round trip to every request; the
  cache is invalidated on billing webhook events (§4).
- No controller inline-checks `org.plan === 'pro'` — every gate goes
  through the decorator so the matrix stays the single source of truth.

## 3. Grace-Period & Downgrade Behavior

`billingStatus` state machine (shared with
`docs/integrations/stripe-saas-billing.md`):

`active` → `pastDue` (grace period, full entitlements) → `locked`
(read-only: view data, no new donations/members/ledger entries) →
back to `active` on successful payment, or `canceled` on explicit
cancellation.

Locking to read-only rather than hard-denying access is deliberate —
church financial and membership data is never made inaccessible purely
because of a billing lapse.

## 4. Source of Truth: Stripe vs. Cashfree Subscriptions

- `OrganizationProfile.billingProvider` (`stripe` | `cashfree`) selects
  which provider's webhooks are authoritative for a given org.
- `EntitlementGuard` never calls Stripe or Cashfree live on the request
  path — it only ever reads the locally synced `planTier`/`billingStatus`
  columns, kept current by webhook handlers. This keeps entitlement
  checks fast and available even if a payment provider is degraded.
