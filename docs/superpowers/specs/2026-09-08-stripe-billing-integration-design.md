# Stripe Billing Integration via BetterAuth — Design

> Status: approved for planning. Owner: platform/auth.

## 1. Problem & Decision

`docs/integrations/stripe-saas-billing.md` and
`docs/architecture/subscription-entitlements.md` describe Stripe billing
as webhook-driven and owned by `parishbooks-billing-svc`, syncing into
`OrganizationProfile.planTier`/`billingStatus`. Neither doc anticipated
BetterAuth's official `stripe()` plugin, which owns its own Customer/
Subscription lifecycle, checkout/portal helpers, and webhook route when
mounted on an auth service.

**Decision:** BetterAuth (`parishbooks-auth-svc`) owns Stripe billing
mechanics going forward — Customer creation, Subscription lifecycle,
checkout/portal, and webhook verification all happen inside the
`stripe()` plugin. `parishbooks-billing-svc` is not the Stripe webhook
owner; its role for Stripe billing is currently empty (it's reserved for
Cashfree Subscriptions parity work, unaffected by this change — see §6).
`OrganizationProfile.planTier`/`billingStatus` remains the single source
of truth `EntitlementGuard` reads; auth-svc pushes updates into it over
HTTP rather than org-svc calling out to Stripe.

Two columns referenced throughout the docs — `OrganizationProfile.
billingStatus` and `billingProvider` — don't exist in the schema yet.
This spec adds them.

## 2. Scope

In scope:
- Migration: `billingStatus`, `billingProvider` columns on
  `OrganizationProfile`.
- A minimal internal-service auth mechanism (shared-secret header),
  scoped to this one caller (auth-svc → org-svc).
- A new internal-only org-svc endpoint to sync billing fields.
- BetterAuth `stripe()` plugin wired into `auth.config.ts`, org-scoped
  subscriptions, two price tiers (Starter/Pro).
- Updating the two affected docs to match the new ownership.

Out of scope (explicitly deferred, not silently dropped):
- The JWT-rotation internal-auth scheme sketched in
  `docs/architecture/microservices-http.md` §5 — no second internal
  caller exists yet to justify building it now. The shared-secret guard
  built here is a named v1 simplification; upgrading to JWT rotation is
  a follow-up when a second internal-only caller appears.
- Cashfree Subscriptions parity (§4 of the stripe-saas-billing doc) —
  unaffected, still future work.
- Frontend checkout/portal UI.
- Grace-period/dunning scheduling logic beyond what BetterAuth's
  webhook hooks give us for free (state transitions only).

## 3. Schema

New TypeORM migration in `packages/database`, generated via
`typeorm migration:generate` (rule 3 — no `synchronize`):

```ts
// OrganizationProfile additions
billingStatus: 'active' | 'pastDue' | 'locked' | 'canceled' // default 'active'
billingProvider: 'stripe' | 'cashfree' | null               // nullable, unset until a subscription exists
```

Both are plain enum columns on the existing `organization_profile`
table, consistent with `planTier`'s existing enum-column pattern.

## 4. Internal service auth

New `InternalServiceGuard` in `packages/core` (`libs/guard/internal`,
alongside the existing `AuthGuard`):

- Reads `x-internal-service-key` from the request header.
- Compares against `INTERNAL_SERVICE_KEY` (same value configured on
  both auth-svc and org-svc via env).
- Throws `UnauthorizedException` on mismatch/missing.
- Endpoints protected by it are also marked `@Public()` against the
  global `AuthGuard` (they carry no end-user Bearer token), and apply
  `InternalServiceGuard` directly via `@UseGuards(InternalServiceGuard)`
  rather than as an `APP_GUARD`, since it must never apply to
  user-facing routes.

`HttpClientService` gains no changes — the caller (auth-svc) simply
passes the header explicitly on this one outbound call; this isn't a
propagation-header concern like `x-tenant-id`/transaction id.

## 5. org-svc: internal billing-sync endpoint

`organization-profile.controller.ts` gains:

```
PATCH /organizations/:organizationId/billing-sync
Header: x-internal-service-key
Body: { planTier?, billingStatus?, billingProvider? }
```

- Guarded by `InternalServiceGuard`, `@Public()` (bypasses `AuthGuard`
  and the `organizationId`/`x-tenant-id` match check used by the
  public profile endpoints — there is no end-user tenant header on a
  service-to-service call).
- Delegates to a new `OrganizationProfileService.syncBilling(
  organizationId, dto)`: finds the profile (404 if missing, same as
  `update`), applies only the provided fields via
  `repository.updateProfile`.
- Deliberately a separate endpoint from the existing public `PATCH
  :organizationId/profile` (which excludes `planTier` per CLAUDE.md rule
  7) rather than widening that DTO — keeps the tenant self-service
  surface and the billing-system-of-record surface from being
  conflated.

## 6. auth-svc: BetterAuth stripe plugin

Dependencies: `stripe`, `@better-auth/stripe`.

`BetterAuthConfig` (`types/auth.types.ts`) gains:
```ts
stripeSecretKey: string;
stripeWebhookSecret: string;
stripeStarterPriceId: string;
stripeProPriceId: string;
orgServiceUrl: string;
internalServiceKey: string;
```

`auth.config.ts` adds the plugin:
```ts
stripe({
  stripeClient: new Stripe(config.stripeSecretKey),
  stripeWebhookSecret: config.stripeWebhookSecret,
  createCustomerOnSignUp: true,
  subscription: {
    enabled: true,
    plans: [
      { name: 'starter', priceId: config.stripeStarterPriceId },
      { name: 'pro', priceId: config.stripeProPriceId },
    ],
    authorizeReference: async ({ user, referenceId }) =>
      // referenceId is the organizationId; verify the caller has an
      // owner/admin role on that org via the organization plugin's
      // membership lookup — reject otherwise.
    onSubscriptionUpdate: async ({ subscription }) =>
      // POST org-svc's billing-sync endpoint with the mapped
      // planTier/billingStatus/billingProvider='stripe'
    onSubscriptionCancel: async ({ subscription }) =>
      // same, billingStatus='canceled'
  },
})
```

`referenceId` is the `organizationId` (org-scoped subscriptions, per
your earlier decision) — every plan/checkout/portal call is keyed on the
org, not the individual user, and `authorizeReference` is what stops any
authenticated user from managing billing for an org they don't
administer.

Both places that currently construct `betterAuthConfig(...)` —
`auth.ts` and `app.module.ts`'s `AuthModule.forRootAsync` factory — get
the six new fields sourced from env (`getOrThrow` for all, matching the
existing required-config pattern; no optional/fallback env reads for
billing config, since a misconfigured billing integration should fail
loud at boot, not degrade silently).

**Webhook event → state mapping** (mirrors the table already in
`stripe-saas-billing.md` §2, now driven by the plugin's hooks instead of
a bespoke webhook handler):

| Plugin event             | `billingStatus` | `planTier`          |
| ------------------------- | ---------------- | -------------------- |
| subscription active       | `active`         | from `plan.name`     |
| subscription past_due     | `pastDue`        | unchanged            |
| subscription canceled     | `canceled`       | unchanged            |
| subscription plan change  | unchanged        | from new `plan.name` |

Grace-period (7-day) and locked-state transition logic from §3 of the
existing doc is unchanged in behavior — only *who* writes
`billingStatus` changes (the plugin's hooks instead of a hand-rolled
webhook handler). No new scheduling code is introduced; `pastDue` →
`locked` after 7 days without payment is out of scope for this spec (see
§2) and stays a follow-up, same as it is today (nothing currently
implements it either).

## 7. Error handling

- `authorizeReference` rejection → BetterAuth returns its standard
  authorization error; no ParishBooks-specific handling needed.
- org-svc billing-sync call failing (network/5xx) inside
  `onSubscriptionUpdate`/`onSubscriptionCancel`: log via the existing
  `Logger` pattern and rethrow — a silent failure here means
  `EntitlementGuard` runs on stale data, which is worse than a visible
  webhook-processing error Stripe will retry.
- `InternalServiceGuard` mismatch → `401`, logged at `warn`.

## 8. Testing

- `InternalServiceGuard`: unit tests for missing header, wrong key,
  correct key.
- `OrganizationProfileService.syncBilling`: partial-field update,
  404 on missing profile — same shape as the existing `update` tests.
- `organization-profile.controller`: billing-sync route delegates
  correctly, is unreachable without the guard's header (integration-ish
  test at the guard level, not re-testing the guard's own logic here).
- Plugin hooks: unit test the mapping function (event → sync payload)
  in isolation; the HTTP call-out itself is tested by asserting
  `HttpClientService.patch` was called with the right URL/headers/body,
  no live Stripe calls.

## 9. Docs to update

- `docs/integrations/stripe-saas-billing.md`: §2 webhook handling now
  describes the BetterAuth plugin's built-in webhook route, not a
  bespoke billing-svc handler; note billing-svc's Stripe role is empty
  pending removal/repurposing.
- `docs/architecture/subscription-entitlements.md`: §4 gets a note that
  `billingProvider`/`billingStatus` are now written via auth-svc's
  internal sync call, not billing-svc.
