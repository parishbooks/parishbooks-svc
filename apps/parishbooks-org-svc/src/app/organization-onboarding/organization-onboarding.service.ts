import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CashfreeVendorStatus } from '@parishbooks/database';
import { OrganizationProfileRepository } from '../organization-profile/organization-profile.repository';
import { OnboardingStatusDto } from './dto/onboarding-status.dto';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';
import { VendorProvider } from './provider/vendor-provider';
import { VendorWebhookEvent, VendorWebhookStatus } from './provider/vendor-provider.types';

const WEBHOOK_STATUS_MAP: Record<VendorWebhookStatus, CashfreeVendorStatus> = {
    pending: CashfreeVendorStatus.PENDING,
    active: CashfreeVendorStatus.ACTIVE,
    rejected: CashfreeVendorStatus.REJECTED,
};

@Injectable()
export class OrganizationOnboardingService {
    constructor(
        private readonly profileRepository: OrganizationProfileRepository,
        private readonly submissionRepository: OrganizationOnboardingSubmissionRepository,
        private readonly vendorProvider: VendorProvider,
    ) {}

    async submit(organizationId: string, submittedByUserId: string, dto: SubmitOnboardingDto): Promise<OnboardingStatusDto> {
        const profile = await this.profileRepository.findByOrganizationId(organizationId);
        if (!profile) throw new NotFoundException(`Organization profile not found for organization ${organizationId}`);
        if (profile.cashfreeVendorStatus === CashfreeVendorStatus.ACTIVE) {
            throw new ConflictException(`Organization ${organizationId} is already onboarded`);
        }

        const result = await this.vendorProvider.createOrUpdateVendor({
            organizationId,
            businessName: dto.businessName,
            panNumber: dto.panNumber,
            bankAccountNumber: dto.bankAccountNumber,
            ifsc: dto.ifsc,
            gstin: dto.gstin,
        });

        await this.submissionRepository.createSubmission({
            organizationId,
            businessName: dto.businessName,
            panNumberMasked: this.vendorProvider.maskLast4(dto.panNumber),
            bankAccountMasked: this.vendorProvider.maskLast4(dto.bankAccountNumber),
            ifsc: dto.ifsc,
            gstin: dto.gstin,
            submittedByUserId,
            providerRawStatus: result.rawStatus,
        });

        const updated = await this.profileRepository.updateProfile(profile.id, {
            cashfreeVendorId: result.vendorId,
            cashfreeVendorStatus: CashfreeVendorStatus.PENDING,
            cashfreeVendorStatusAt: new Date(),
        });

        return this.toStatusDto(updated);
    }

    async getStatus(organizationId: string): Promise<OnboardingStatusDto> {
        const profile = await this.profileRepository.findByOrganizationId(organizationId);
        if (!profile) throw new NotFoundException(`Organization profile not found for organization ${organizationId}`);
        return this.toStatusDto(profile);
    }

    async applyWebhookEvent(event: VendorWebhookEvent): Promise<void> {
        const profile = await this.profileRepository.findByCashfreeVendorId(event.vendorId);
        if (!profile) return;
        await this.profileRepository.updateProfile(profile.id, {
            cashfreeVendorStatus: WEBHOOK_STATUS_MAP[event.status],
            cashfreeVendorStatusAt: new Date(),
        });
    }

    private toStatusDto(profile: { organizationId: string; cashfreeVendorStatus: CashfreeVendorStatus; cashfreeVendorStatusAt?: Date }): OnboardingStatusDto {
        return {
            organizationId: profile.organizationId,
            vendorStatus: profile.cashfreeVendorStatus,
            vendorStatusAt: profile.cashfreeVendorStatusAt ?? null,
        };
    }
}
