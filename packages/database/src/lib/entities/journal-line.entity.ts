import { Check, Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// Append-only, same as JournalEntry (see its immutability-trigger note).
// The CHECK constraint is a DB-level backstop against writes that bypass
// LedgerService.postEntry() — it can only see one line, so it is not a
// substitute for the whole-entry SUM(debit) == SUM(credit) balance check
// enforced in the service layer (docs/specs/double-entry-ledger.md §1).
@Entity('journal_line')
@Index(['organizationId', 'id'])
@Index(['organizationId', 'journalEntryId'])
@Check(`("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)`)
export class JournalLine extends TenantEntity {
    @Column({ type: 'uuid' })
    journalEntryId!: string;

    @Column({ type: 'uuid' })
    accountId!: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    debit!: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    credit!: string;

    @Column({ type: 'text', nullable: true })
    memo?: string;
}
