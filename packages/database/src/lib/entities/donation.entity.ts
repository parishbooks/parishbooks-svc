import { Column, Entity, Index } from 'typeorm';
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
// Uniqueness on idempotencyKey/providerPaymentId is scoped to
// deleted_at IS NULL (partial index) rather than a plain UNIQUE
// constraint — a plain constraint would permanently occupy a donor's
// idempotency key even after the row is soft-deleted, breaking the
// "retry returns the same row" guarantee in
// docs/specs/mobile-giving-app.md §4 the first time a Donation is ever
// soft-deleted.
@Entity('donation')
@Index(['organizationId', 'id'])
@Index(['organizationId', 'fundId'])
@Index(['organizationId', 'idempotencyKey'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['providerPaymentId'], { unique: true, where: '"deleted_at" IS NULL' })
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

    @Column({ type: 'text', nullable: true })
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
