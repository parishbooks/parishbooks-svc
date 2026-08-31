# Tax Receipts — 80G (India) & 501(c)(3) (US)

> India-first donation tax receipt generation. US 501(c)(3) is a scoped Phase 2 addendum.

## Table of Contents

1. India — 80G Receipt Fields, PAN Capture & QR Verification
2. India — FCRA Fund Segregation Rules
3. Fund-Tagging Requirement at Donation Time
4. Phase 2 (Deferred): US 501(c)(3) Statement Format & Deltas from the India Model

## 1. India — 80G Receipt Fields, PAN Capture & QR Verification

Each `Receipt` (`docs/specs/typeorm-database-schema.md`) renders a PDF
containing:

- Organization's registration number and 80G approval number
  (`OrganizationProfile`).
- Donor name, PAN (or an explicit "PAN not provided" note — a donation
  without PAN still gets a receipt, but the donor may not be able to
  claim it above certain limits under Indian tax rules; PAN capture is
  optional at donation time, not blocking).
- Amount, date, payment mode, and the sequential `receiptNumber`
  (per `(organizationId, financialYear)` — Indian financial year runs
  April–March, not calendar year).
- A QR code encoding `Receipt.qrVerificationToken`, resolving to a public
  `/verify/receipt/:token` page so the donor or the Income Tax
  Department can confirm authenticity independent of the PDF.
- PAN format is validated (10-character alphanumeric, standard Indian PAN
  pattern) at capture time, before it's accepted onto the `Donation`.

## 2. India — FCRA Fund Segregation Rules

- `Fund.fcraFlag` distinguishes foreign-contribution-eligible funds from
  domestic-only funds.
- A donation from a foreign source may only be applied to a fund where
  `fcraFlag = true`, and only if `OrganizationProfile.fcraRegistered =
  true`. Both conditions are checked at **donation-intent creation** —
  before the Cashfree order is even created — not after payment
  succeeds, since FCRA violations can't be undone by refunding after the
  fact.
- An org that isn't FCRA-registered simply doesn't offer any
  `fcraFlag=true` funds in its Give flow; the check is enforced
  server-side regardless of what the client sends.

## 3. Fund-Tagging Requirement at Donation Time

- The donor selects a `Fund` as part of creating the donation (CLAUDE.md
  rule 6) — the donation-creation endpoint rejects any request missing
  `fundId`.
- At receipt issuance, `ReceiptService` copies `Fund.fcraFlag` into
  `Receipt.fundFcraSnapshot`. This snapshot is what makes receipts
  immutable in practice: if a fund's FCRA classification is later
  corrected (e.g. an admin mistake), already-issued receipts are
  unaffected — only newly issued receipts reflect the change. A
  reclassification that affects a fund's donors requires manually
  reissuing affected receipts, which is an explicit admin action, never
  automatic.

## 4. Phase 2 (Deferred): US 501(c)(3)

Not implemented in this phase — documented here so the India-first
design doesn't foreclose it. Known deltas from the India model:

- No PAN or QR-verification requirement. Instead, US year-end
  acknowledgment letters require the org's EIN and the standard
  "no goods or services were provided in exchange for this contribution"
  language (or a description/valuation of any goods/services that were).
- No FCRA equivalent — foreign-source restrictions don't apply the same
  way; US 501(c)(3) orgs have their own (different) restrictions on
  political and lobbying activity that are out of scope for this
  document.
- Receipting cadence differs: US orgs commonly issue a single annual
  contribution statement rather than a per-donation receipt, in addition
  to (or instead of) per-donation acknowledgments.

`OrganizationProfile.country = 'US'` is reserved for this phase; no
receipt logic currently branches on it.
