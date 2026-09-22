import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// KYC submission audit trail for vendor onboarding
// (docs/superpowers/specs/2026-09-22-vendor-onboarding-kyc-design.md §4).
// Deliberately never stores raw PAN or full bank account number — those
// go straight to the payment provider's API and only the masked form is
// kept here for the admin-facing "what did we submit" view
// (docs/quality-ops/security-observability.md §4).
@Entity('organization_onboarding_submission')
@Index(['organizationId', 'id'])
export class OrganizationOnboardingSubmission extends TenantEntity {
    @Column({ type: 'text' })
    businessName!: string;

    @Column({ type: 'text' })
    panNumberMasked!: string;

    @Column({ type: 'text' })
    bankAccountMasked!: string;

    @Column({ type: 'text' })
    ifsc!: string;

    @Column({ type: 'text', nullable: true })
    gstin?: string;

    @Column({ type: 'uuid' })
    submittedByUserId!: string;

    @Column({ type: 'text', nullable: true })
    providerRawStatus?: string;
}
