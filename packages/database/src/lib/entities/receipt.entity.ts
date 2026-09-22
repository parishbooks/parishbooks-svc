import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// 1:1 with Donation. fundFcraSnapshot is copied from Fund.fcraFlag at issue
// time so a later fund reclassification never alters an already-issued
// receipt — docs/compliance/tax-receipts-80g-501c3.md §3.
@Entity('receipt')
@Index(['organizationId', 'id'])
@Unique(['donationId'])
export class Receipt extends TenantEntity {
    @Column({ type: 'uuid' })
    donationId!: string;

    // Sequential per (organizationId, financialYear) — India FY runs
    // Apr-Mar, not calendar year. financialYear is derived from issuedAt
    // by ReceiptService, not stored as a separate column.
    @Column({ type: 'text' })
    receiptNumber!: string;

    @Column({ type: 'boolean' })
    fundFcraSnapshot!: boolean;

    @Column({ type: 'text', nullable: true })
    pdfUrl?: string;

    @Column({ type: 'text', unique: true })
    qrVerificationToken!: string;

    @Column({ type: 'timestamptz' })
    issuedAt!: Date;
}
