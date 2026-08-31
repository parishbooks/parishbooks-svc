# Double-Entry Ledger

> Immutable financial ledger engine rules for ParishBooks.

## Table of Contents

1. Debit/Credit Invariant (`SUM(debit) == SUM(credit)`)
2. Chart of Accounts Structure
3. Posting Rules (Append-Only, Reversal Not Edit)
4. Period Close & Reconciliation

## 1. Debit/Credit Invariant

`LedgerService.postEntry()` (`libs/shared/typeorm` or a future
`parishbooks-ledger-svc`) is the **only** sanctioned write path into
`JournalEntry`/`JournalLine` — see the transaction example in
`docs/specs/typeorm-database-schema.md`. Before issuing any insert it:

1. Rejects entries with fewer than 2 lines.
2. Converts every `debit`/`credit` value to integer minor units (paise/cents)
   before summing — comparing `numeric(12,2)` values directly risks
   floating-point rounding drift; integer comparison doesn't.
3. Asserts `sum(debitMinorUnits) === sum(creditMinorUnits)` for the whole
   entry. Any mismatch throws `LedgerUnbalancedEntryError` and the whole
   transaction (including whatever business row triggered the posting,
   e.g. a `Donation`) rolls back — a donation is never saved without its
   matching, balanced ledger entry.
4. A DB-level `CHECK` constraint on `JournalLine` (exactly one of
   debit/credit `> 0`) is a backstop against writes that somehow bypass
   the service layer — it is not a substitute for the check above, since
   it can't see the whole entry, only one line.

## 2. Chart of Accounts Structure

- Five top-level `Account.type` values: `asset`, `liability`, `equity`,
  `income`, `expense`.
- Code ranges by convention: `1xxx` asset, `2xxx` liability, `3xxx`
  equity, `4xxx` income, `5xxx` expense. `Account.parentAccountId` builds
  a hierarchy under each range (e.g. `4000 Donations` → `4100 General
  Fund`, `4200 Building Fund`).
- Every new `Organization` gets a default chart of accounts seeded in the
  same transaction that creates its `OrganizationProfile` (cash/bank
  asset accounts, a donations income account per default fund, standard
  expense categories). Orgs can add accounts under the existing top-level
  types; they cannot introduce a 6th top-level type without a schema
  change.
- `Account.isActive` retires an account; accounts are never deleted once
  a `JournalLine` references them, to preserve historical entries.

## 3. Posting Rules

- **Append-only.** `JournalEntry` and `JournalLine` rows are never
  `UPDATE`d or `DELETE`d after creation (CLAUDE.md rule 2).
- **Corrections are reversing entries**, not edits: a new `JournalEntry`
  with `reversalOfEntryId` pointing at the original, carrying the exact
  inverse debit/credit lines. Both the original and the reversal remain
  visible — the ledger's history is never rewritten.
- **Traceability.** Every entry sets `sourceType` (`donation`, `manual`,
  `payroll`, `adjustment`, `reversal`) and `sourceId`, so any ledger line
  can be traced back to the record that caused it.
- **No side doors.** Code review rejects any direct
  `@InjectRepository(JournalEntry)` / `@InjectRepository(JournalLine)`
  usage outside `LedgerService` — every posting path (donations, manual
  adjustments, future payroll/subscription billing) goes through
  `postEntry()`.

## 4. Period Close & Reconciliation

- Monthly close: once a period is closed, no new `JournalEntry` may be
  dated inside it. Corrections to a closed period are posted as
  adjustment entries dated in the current open period, referencing the
  original via `sourceId`/description — the closed period's own rows are
  never touched.
- Reconciliation: donation-sourced entries are reconciled against
  Cashfree settlement reports (amount, provider payment id) on a
  scheduled job; discrepancies are flagged for manual review rather than
  auto-corrected.
- Trial balance: a report summing `debit`/`credit` per account per
  organization; for a healthy ledger, total debits equal total credits
  across *all* accounts for *all* time — this is the invariant from §1
  extended across the whole ledger, and is the standard sanity check run
  after every close.
