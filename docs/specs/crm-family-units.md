# CRM — Family Units

> Family-centric directory model, ward/prayer-cell mapping, and member census tracking.

## Table of Contents

1. Family / Member Relationship Model
2. Parish Ward & Prayer Cell Mapping
3. Member Census & Attendance Tracking
4. Merge & Duplicate Handling

## 1. Family / Member Relationship Model

- `Family` is the primary directory unit (a household); `Member.familyId`
  is nullable — a member without a family is a normal "single-member
  household," not an error state.
- One `Member` per family is optionally flagged head-of-household
  (`Member.isHeadOfHousehold`), used for household-level mailing and
  giving statements.
- A `Member` may optionally link to a login identity via
  `Member.betterAuthUserId` if they have congregant-app access — most
  `Member` rows (e.g. children, or members who don't use the app) have no
  linked user account, which is expected.

## 2. Parish Ward & Prayer Cell Mapping

- **Ward** — a geographic/administrative subdivision of the parish.
- **Prayer Cell** — a smaller fellowship group that cuts across wards.
- v1: a `Member` belongs to at most one `Ward` and one `Prayer Cell`
  (`Member.wardId` / `Member.prayerCellId`, both nullable FKs) — simple
  many-to-one relationships. Many-to-many (a member in multiple prayer
  cells) is a deliberately deferred scope decision; revisit only if a
  parish explicitly needs it.

## 3. Member Census & Attendance Tracking

- v1 tracks periodic **aggregate headcounts** per service/event, rolled
  up by ward — not individual per-member check-in. This keeps data entry
  to one form per service rather than requiring check-in infrastructure
  the platform doesn't have yet.
- Census entries are a simple time-series (`date`, `serviceName`,
  `wardId`, `headcount`) used for attendance trend reporting.

## 4. Merge & Duplicate Handling

- Admins get a manual merge tool for duplicate `Member` records (common
  after bulk imports).
- Merges are **soft**: the losing record gets `mergedIntoMemberId` set
  and `membershipStatus` forced to a terminal "merged" state — it is
  never hard-deleted, because `Donation.memberId` and other historical
  references must keep resolving.
- On merge, `Donation`, `Receipt`, and any other FK referencing the
  losing `Member.id` are re-pointed to the surviving record as part of
  one transaction, so giving history stays intact under the merged
  identity.
