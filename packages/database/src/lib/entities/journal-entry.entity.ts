import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export enum JournalEntrySourceType {
    DONATION = 'donation',
    MANUAL = 'manual',
    PAYROLL = 'payroll',
    ADJUSTMENT = 'adjustment',
    REVERSAL = 'reversal',
}

// Append-only — CLAUDE.md rule 2. Never UPDATE/DELETE a row here; corrections
// are a new entry with reversalOfEntryId set. The only sanctioned write path
// is LedgerService.postEntry() — see docs/specs/double-entry-ledger.md.
// Enforced at the DB level (not just by convention) by a BEFORE
// UPDATE OR DELETE trigger — see migration
// AddJournalImmutabilityTriggers.
@Entity('journal_entry')
@Index(['organizationId', 'id'])
export class JournalEntry extends TenantEntity {
    @Column({ type: 'date' })
    date!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'enum', enum: JournalEntrySourceType })
    sourceType!: JournalEntrySourceType;

    @Column({ type: 'uuid', nullable: true })
    sourceId?: string;

    @Column({ type: 'uuid', nullable: true })
    reversalOfEntryId?: string;

    @Column({ type: 'uuid' })
    createdBy!: string;
}
