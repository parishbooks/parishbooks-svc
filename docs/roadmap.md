# Roadmap & Phase 1 Scope

> Product sequencing for ParishBooks. This is the map for "what should I
> build next" — see `CLAUDE.md` for the architectural rules that apply
> regardless of phase.

## Table of Contents

1. Phase 1 Goal
2. In Scope for Phase 1
3. Explicitly Out of Scope for Phase 1
4. Service Build State (as of 2026-09-22)
5. Definition of Done for Phase 1

## 1. Phase 1 Goal

Ship **Giving**: a congregant can give tithes and offerings to their
church through ParishBooks (back-office-initiated and/or the Expo
congregant app), the church receives the funds via Cashfree Easy Split,
and the donor gets a correct 80G receipt. Every other capability in the
platform (CRM, general-ledger reporting, SaaS subscription billing for
churches) is sequenced **after** Giving is live, not alongside it.

Everything in this doc is scope sequencing, not an exception to the
non-negotiable rules in `CLAUDE.md` (tenant isolation, append-only ledger,
migrations-only, webhook idempotency, fund-tagging at creation) — those
apply to Phase 1 code exactly as they will to every later phase.

## 2. In Scope for Phase 1

The minimum slice needed for a donor to give and a church to receive:

- **Auth & multi-tenancy** (`parishbooks-auth-svc`) — sign-in/sign-up,
  OTP, JWT issuance, org switching, session revocation. Already
  substantially built; see recent commits and
  `docs/architecture/multi-tenancy-betterauth.md`.
- **Organization profile** (`parishbooks-org-svc`) — church record,
  Cashfree vendor KYC status (`docs/integrations/cashfree-giving-split.md`
  §1). A church can't accept donations until this exists.
- **Minimal donor identity** — enough of `Member`/`Family`
  (`docs/specs/typeorm-database-schema.md`) to attribute a donation to a
  person for receipting purposes. This is **not** the CRM feature (§3) —
  no household management UI, no pledge campaigns, no attendance.
- **Fund model** — `Fund` entity with FCRA/restricted flags
  (`docs/specs/typeorm-database-schema.md`), since fund-tagging at
  donation creation is a non-negotiable rule and an 80G/FCRA launch
  blocker.
- **Ledger posting** (`parishbooks-ledger-svc`) — append-only
  double-entry posting triggered by a completed donation
  (`docs/specs/double-entry-ledger.md`). Required because donation
  completion and ledger entry are the same transaction, not because
  Phase 1 ships general ledger reporting (see §3).
- **Giving** (`parishbooks-giving-svc`) — donation creation, Cashfree
  Easy Split order creation and webhook handling
  (`docs/integrations/cashfree-giving-split.md`), idempotent donation
  submission (`docs/specs/mobile-giving-app.md` §4).
- **80G receipts** — sequential receipt numbering and PDF generation
  triggered off a completed donation
  (`docs/compliance/tax-receipts-80g-501c3.md`,
  `docs/integrations/cashfree-giving-split.md` §4). India-first launch
  blocker per `CLAUDE.md`.
- **Kong + back-office BFF** — Kong routes north–south traffic; the
  Next.js `/api` BFF in `parishbooks-backoffice` is the only API surface
  the back-office UI uses. Services validate JWTs via `AuthGuard` per
  `docs/architecture/microservices-http.md`.
- **Congregant app give flow** — the screens in
  `docs/specs/mobile-giving-app.md` §1 that support giving and giving
  history. Family Profile editing can be as thin as needed to support
  receipting, not a full CRM surface.
- **Back-office give flow** — enough of the Next.js back-office for a
  church admin to see incoming donations and confirm vendor KYC status;
  not a full financial reporting suite.

## 3. Explicitly Out of Scope for Phase 1

Deferred, not abandoned — sequenced into later phases once Giving is
live and validated with real churches:

- **CRM** (`parishbooks-member-svc`, `docs/specs/crm-family-units.md`) —
  household management, member directories, attendance, pledge
  campaigns beyond what §2 needs for receipting.
- **General ledger reporting** — multi-fund reports, statements, the
  `reporting.multi-fund` entitlement in
  `docs/architecture/subscription-entitlements.md`. Ledger *posting* is
  in scope (§2); ledger *reporting UI* is not.
- **SaaS subscription billing** (`parishbooks-billing-svc`, Stripe +
  Cashfree Subscriptions, `docs/integrations/stripe-saas-billing.md`) —
  charging churches the $49/$149 platform fee. Phase 1 churches are
  onboarded without a paid plan gate; the entitlement matrix in
  `docs/architecture/subscription-entitlements.md` stays aspirational
  until this phase starts.
- **Events** (`parishbooks-events-svc`) — no defined scope yet at all;
  not started until after Phase 1 and the CRM phase.
- **US 501(c)(3) compliance addendum** — India-first only for Phase 1
  (`docs/compliance/tax-receipts-80g-501c3.md`); the 501(c)(3) path is a
  documented Phase 2 addendum, not a Phase 1 blocker.

If a task touches one of these areas and isn't required to make Giving
work end-to-end, flag it as out-of-phase rather than building it —
ask before picking it up.

## 4. Service Build State (as of 2026-09-22)

Rough signal only (file count under each service's `src/`) — check the
service directly before relying on this, it will drift:

| Service                    | State                    | Phase 1 role                        |
| --------------------------- | ------------------------ | ------------------------------------ |
| `parishbooks-auth-svc`     | Actively built out       | Required — mostly done               |
| Kong + back-office BFF     | In progress              | Required                             |
| `parishbooks-org-svc`      | Actively built out       | Required                             |
| `parishbooks-giving-svc`   | Scaffold only            | Required — main Phase 1 build target |
| `parishbooks-ledger-svc`   | Scaffold only            | Required — main Phase 1 build target |
| `parishbooks-billing-svc`  | Scaffold only            | Out of scope (§3)                    |
| `parishbooks-member-svc`   | Scaffold only            | Out of scope (§3)                    |
| `parishbooks-events-svc`   | Scaffold only            | Out of scope (§3)                    |

## 5. Definition of Done for Phase 1

Giving is launch-ready when, for a real church org:

1. A church completes Cashfree vendor KYC and reaches `ACTIVE` status.
2. A congregant signs in, picks a fund, and completes a one-time
   donation through the mobile app's Cashfree Drop-in flow.
3. The webhook posts a balanced ledger entry and marks the donation
   `completed`, exactly once, even under webhook retry.
4. An 80G receipt with a correct sequential number and FCRA snapshot
   generates and is downloadable from Giving History.
5. All of the above pass `docs/quality-ops/testing-strategy.md`'s bar for
   giving/ledger business logic — a test that fails if the invariant
   (balanced entry, dedupe, fund-tagging) breaks.
