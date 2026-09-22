import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum OrganizationCountry {
    IN = 'IN',
    US = 'US',
}

export enum OrganizationPlanTier {
    STARTER = 'starter',
    PRO = 'pro',
}

export enum OrganizationCurrency {
    INR = 'INR',
    USD = 'USD',
}

export enum OrganizationBillingStatus {
    ACTIVE = 'active',
    PAST_DUE = 'pastDue',
    LOCKED = 'locked',
    CANCELED = 'canceled',
}

export enum OrganizationBillingProvider {
    STRIPE = 'stripe',
    CASHFREE = 'cashfree',
}

export enum CashfreeVendorStatus {
    NOT_STARTED = 'not_started',
    PENDING = 'pending',
    ACTIVE = 'active',
    REJECTED = 'rejected',
}

@Entity('organization_profile')
@Unique(['organizationId'])
export class OrganizationProfile extends BaseEntity {
    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'enum', enum: OrganizationCountry, default: OrganizationCountry.IN })
    country!: OrganizationCountry;

    @Column({ type: 'boolean', default: false })
    fcraRegistered!: boolean;

    @Column({ type: 'enum', enum: OrganizationPlanTier, default: OrganizationPlanTier.STARTER })
    planTier!: OrganizationPlanTier;

    @Column({ type: 'enum', enum: OrganizationBillingStatus, default: OrganizationBillingStatus.ACTIVE })
    billingStatus!: OrganizationBillingStatus;

    @Column({ type: 'enum', enum: OrganizationBillingProvider, nullable: true })
    billingProvider?: OrganizationBillingProvider;

    @Column({ type: 'text' })
    timezone!: string;

    @Column({ type: 'enum', enum: OrganizationCurrency, default: OrganizationCurrency.INR })
    currency!: OrganizationCurrency;

    @Column({ type: 'text', nullable: true })
    registrationNumber?: string;

    @Column({ type: 'text', nullable: true })
    taxExemptionNumber80g?: string;

    @Column({ type: 'text', nullable: true })
    ein?: string;

    @Column({ type: 'text', nullable: true })
    cashfreeVendorId?: string;

    @Column({ type: 'enum', enum: CashfreeVendorStatus, default: CashfreeVendorStatus.NOT_STARTED })
    cashfreeVendorStatus!: CashfreeVendorStatus;

    @Column({ type: 'timestamptz', nullable: true })
    cashfreeVendorStatusAt?: Date;
}
