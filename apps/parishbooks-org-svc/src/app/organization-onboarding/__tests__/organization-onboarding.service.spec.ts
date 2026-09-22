import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CashfreeVendorStatus } from '@parishbooks/database';
import { DataSource, EntityManager } from 'typeorm';
import { OrganizationProfileRepository } from '../../organization-profile/organization-profile.repository';
import { OrganizationOnboardingSubmissionRepository } from '../organization-onboarding-submission.repository';
import { OrganizationOnboardingService } from '../organization-onboarding.service';
import { VendorProvider } from '../provider/vendor-provider';

describe('OrganizationOnboardingService', () => {
    let service: OrganizationOnboardingService;
    let dataSource: { transaction: jest.Mock };
    let fakeManager: EntityManager;
    let profileRepository: { findByOrganizationId: jest.Mock; findByCashfreeVendorId: jest.Mock; updateProfile: jest.Mock };
    let submissionRepository: { createSubmission: jest.Mock };
    let vendorProvider: { createOrUpdateVendor: jest.Mock; maskLast4: jest.Mock };

    beforeEach(async () => {
        fakeManager = {} as EntityManager;
        dataSource = { transaction: jest.fn((fn: (manager: EntityManager) => unknown) => fn(fakeManager)) };
        profileRepository = {
            findByOrganizationId: jest.fn(),
            findByCashfreeVendorId: jest.fn(),
            updateProfile: jest.fn((_id, data) => ({ id: 'profile-1', organizationId: 'org-1', ...data })),
        };
        submissionRepository = { createSubmission: jest.fn() };
        vendorProvider = { createOrUpdateVendor: jest.fn(), maskLast4: jest.fn((v: string) => `masked:${v.slice(-4)}`) };

        const module = await Test.createTestingModule({
            providers: [
                OrganizationOnboardingService,
                { provide: DataSource, useValue: dataSource },
                { provide: OrganizationProfileRepository, useValue: profileRepository },
                { provide: OrganizationOnboardingSubmissionRepository, useValue: submissionRepository },
                { provide: VendorProvider, useValue: vendorProvider },
            ],
        }).compile();

        service = module.get(OrganizationOnboardingService);
    });

    describe('submit', () => {
        const dto = { businessName: 'Church', panNumber: 'ABCDE1234F', bankAccountNumber: '123456789012', ifsc: 'HDFC0000123', gstin: undefined };

        it('throws NotFoundException when the org has no profile yet', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue(null);

            await expect(service.submit('org-1', 'user-1', dto)).rejects.toThrow(NotFoundException);
            expect(dataSource.transaction).not.toHaveBeenCalled();
        });

        it('throws ConflictException when the org is already ACTIVE', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE });

            await expect(service.submit('org-1', 'user-1', dto)).rejects.toThrow(ConflictException);
            expect(vendorProvider.createOrUpdateVendor).not.toHaveBeenCalled();
            expect(dataSource.transaction).not.toHaveBeenCalled();
        });

        it('calls the provider, stores a masked submission, and sets status PENDING inside a single transaction', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', organizationId: 'org-1', cashfreeVendorStatus: CashfreeVendorStatus.NOT_STARTED });
            vendorProvider.createOrUpdateVendor.mockResolvedValue({ vendorId: 'vendor-123', rawStatus: 'PENDING' });

            const result = await service.submit('org-1', 'user-1', dto);

            expect(vendorProvider.createOrUpdateVendor).toHaveBeenCalledWith({
                organizationId: 'org-1',
                businessName: 'Church',
                panNumber: 'ABCDE1234F',
                bankAccountNumber: '123456789012',
                ifsc: 'HDFC0000123',
                gstin: undefined,
            });
            expect(dataSource.transaction).toHaveBeenCalledTimes(1);
            expect(submissionRepository.createSubmission).toHaveBeenCalledWith(
                expect.objectContaining({
                    organizationId: 'org-1',
                    businessName: 'Church',
                    panNumberMasked: 'masked:234F',
                    bankAccountMasked: 'masked:9012',
                    ifsc: 'HDFC0000123',
                    submittedByUserId: 'user-1',
                    providerRawStatus: 'PENDING',
                }),
                fakeManager,
            );
            expect(profileRepository.updateProfile).toHaveBeenCalledWith(
                'profile-1',
                expect.objectContaining({ cashfreeVendorId: 'vendor-123', cashfreeVendorStatus: CashfreeVendorStatus.PENDING }),
                fakeManager,
            );
            expect(result.vendorStatus).toBe(CashfreeVendorStatus.PENDING);
        });
    });

    describe('getStatus', () => {
        it('throws NotFoundException when the org has no profile', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue(null);

            await expect(service.getStatus('org-1')).rejects.toThrow(NotFoundException);
        });

        it('returns the current vendor status', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ organizationId: 'org-1', cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE, cashfreeVendorStatusAt: new Date('2026-01-01') });

            const result = await service.getStatus('org-1');

            expect(result).toEqual({ organizationId: 'org-1', vendorStatus: CashfreeVendorStatus.ACTIVE, vendorStatusAt: new Date('2026-01-01'), rejectionReason: undefined });
        });

        it('surfaces a stored rejection reason', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({
                organizationId: 'org-1',
                cashfreeVendorStatus: CashfreeVendorStatus.REJECTED,
                cashfreeVendorStatusAt: new Date('2026-01-01'),
                cashfreeVendorRejectionReason: 'PAN mismatch',
            });

            const result = await service.getStatus('org-1');

            expect(result.rejectionReason).toBe('PAN mismatch');
        });
    });

    describe('applyWebhookEvent', () => {
        it('is a no-op when no profile matches the vendor id', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue(null);

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'unknown-vendor', status: 'active' });

            expect(profileRepository.updateProfile).not.toHaveBeenCalled();
        });

        it('updates the matched org to ACTIVE', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue({ id: 'profile-1' });

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' });

            expect(profileRepository.updateProfile).toHaveBeenCalledWith('profile-1', expect.objectContaining({ cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE }));
        });

        it('updates the matched org to REJECTED and persists the rejection reason', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue({ id: 'profile-1' });

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'rejected', rejectionReason: 'PAN mismatch' });

            expect(profileRepository.updateProfile).toHaveBeenCalledWith(
                'profile-1',
                expect.objectContaining({ cashfreeVendorStatus: CashfreeVendorStatus.REJECTED, cashfreeVendorRejectionReason: 'PAN mismatch' }),
            );
        });
    });
});
