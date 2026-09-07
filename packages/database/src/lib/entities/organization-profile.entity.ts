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

// 1:1 extension of BetterAuth's `organization` table. Not a TenantEntity —
// this row *is* the organization, not tenant-scoped data belonging to one.
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
}
