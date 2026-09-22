import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export enum DonationStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export enum DonationCurrency {
    INR = 'INR',
    USD = 'USD',
}

export enum DonationPaymentProvider {
    CASHFREE = 'cashfree',
}

// fundId is set at creation and never changed after (CLAUDE.md rule 6).
// journalEntryId/providerPaymentId stay null until the PAYMENT_SUCCESS
// webhook completes the donation — see
// docs/integrations/cashfree-giving-split.md §4.
@Entity('donation')
@Index(['organizationId', 'id'])
@Index(['organizationId', 'fundId'])
@Unique(['organizationId', 'idempotencyKey'])
export class Donation extends TenantEntity {
    @Column({ type: 'uuid', nullable: true })
    memberId?: string;

    @Column({ type: 'uuid' })
    fundId!: string;

    @Column({ type: 'uuid' })
    accountId!: string;

    @Column({ type: 'numeric', precision: 12, scale: 2 })
    amount!: string;

    @Column({ type: 'enum', enum: DonationCurrency })
    currency!: DonationCurrency;

    @Column({ type: 'enum', enum: DonationStatus, default: DonationStatus.PENDING })
    status!: DonationStatus;

    // Client-generated per attempt — docs/specs/mobile-giving-app.md §4.
    // Retrying with the same key returns the existing row instead of
    // creating a duplicate donation.
    @Column({ type: 'text' })
    idempotencyKey!: string;

    @Column({ type: 'enum', enum: DonationPaymentProvider })
    paymentProvider!: DonationPaymentProvider;

    @Column({ type: 'text', nullable: true })
    cashfreeOrderId?: string;

    @Column({ type: 'text', nullable: true, unique: true })
    providerPaymentId?: string;

    @Column({ type: 'text', nullable: true })
    panNumber?: string;

    @Column({ type: 'uuid', nullable: true })
    journalEntryId?: string;

    @Column({ type: 'text', nullable: true })
    failureReason?: string;

    @Column({ type: 'timestamptz', nullable: true })
    donatedAt?: Date;
}
