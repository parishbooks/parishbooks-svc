import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export enum AccountType {
    ASSET = 'asset',
    LIABILITY = 'liability',
    EQUITY = 'equity',
    INCOME = 'income',
    EXPENSE = 'expense',
}

// Chart of accounts — docs/specs/double-entry-ledger.md §2. Accounts are
// retired via isActive, never deleted once a JournalLine references them.
@Entity('account')
@Index(['organizationId', 'id'])
@Unique(['organizationId', 'code'])
export class Account extends TenantEntity {
    @Column({ type: 'text' })
    code!: string;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'enum', enum: AccountType })
    type!: AccountType;

    @Column({ type: 'uuid', nullable: true })
    parentAccountId?: string;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;
}
