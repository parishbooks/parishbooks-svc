# Mobile Giving App

> React Native + Expo congregant app layout and giving flow.

## Table of Contents

1. Screen Map (Giving, History, Family Profile)
2. Biometric Authentication (Expo LocalAuthentication)
3. Cashfree Mobile SDK Integration
4. Offline / Retry Behavior for Pledges

## 1. Screen Map

- **Auth** — sign-in/OTP screens backed by the BetterAuth client (same
  session model as the back-office; see
  `docs/architecture/multi-tenancy-betterauth.md`). A congregant with
  `member` rows in more than one `organization` gets a church picker.
- **Home / Give** — fund picker (`Fund` list for the active organization),
  amount entry, one-time vs. recurring toggle.
- **Payment** — hands off to the Cashfree Drop-in UI (§3); app never
  collects raw card/UPI credentials itself.
- **Giving History** — list of the member's own `Donation` rows (status:
  processing/completed/failed), with receipt download once a `Receipt`
  exists (`docs/specs/typeorm-database-schema.md`).
- **Family Profile** — the member's own `Member`/`Family` record, other
  family members, contact info edit.

## 2. Biometric Authentication

- `expo-local-authentication` gates app unlock and, above a
  per-organization configurable amount threshold, confirms a donation
  before submission.
- Preference (biometric on/off) stored per-device; fallback is the
  BetterAuth session's normal re-auth (passcode/OTP), never a silent
  bypass — a failed or unavailable biometric check must not skip
  donation confirmation, only substitute the fallback flow.

## 3. Cashfree Mobile SDK Integration

- Order creation is server-side only: the app calls the giving service
  (`POST /donations` on `parishbooks-giving-svc`, via the gateway), which
  creates the Cashfree order (with the vendor split — see
  `docs/integrations/cashfree-giving-split.md`) and returns a payment
  session id/token.
- The app hands that token to the Cashfree React Native SDK, which
  renders the UPI/card/NetBanking UI and talks to Cashfree directly —
  ParishBooks servers and app code never see raw payment instrument data.
- On completion, the SDK returns a client-side result, but the
  authoritative outcome is always the server-to-server webhook (§4 of
  the Cashfree integration doc) — the app polls/reflects order status,
  it never marks a donation "completed" purely from the SDK callback.

## 4. Offline / Retry Behavior for Pledges

- Before opening the Cashfree SDK, the app generates a client-side
  idempotency key and creates the `Donation` in a `pending` state via the
  idempotency-key-protected endpoint (`docs/architecture/api-conventions-error-handling.md`).
- If the network drops mid-payment, the app does **not** resubmit a new
  donation on reconnect — it polls `GET /donations/:id` (or re-sends the
  same idempotency key, which returns the cached in-flight state) until
  the webhook-driven status settles to `completed` or `failed`.
- Pending donations surface in Giving History as "Processing" so the
  member isn't left wondering whether the gift went through, and isn't
  tempted to pay twice.
