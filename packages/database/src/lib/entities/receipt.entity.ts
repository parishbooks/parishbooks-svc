import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// 1:1 with Donation. fundFcraSnapshot is copied from Fund.fcraFlag at issue
// time so a later fund reclassification never alters an already-issued
// receipt — docs/compliance/tax-receipts-80g-501c3.md §3.
@Entity('receipt')
@Index(['organizationId', 'id'])
@Unique(['donationId'])
@Unique(['organizationId', 'financialYear', 'receiptNumber'])
export class Receipt extends TenantEntity {
    @Column({ type: 'uuid' })
    donationId!: string;

    // India FY runs Apr-Mar, stored (not derived from issuedAt at read
    // time) so the DB can enforce receipt-number uniqueness per FY —
    // format e.g. "2026-27", set by ReceiptService at issuance.
    @Column({ type: 'text' })
    financialYear!: string;

    // Sequential per (organizationId, financialYear).
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
