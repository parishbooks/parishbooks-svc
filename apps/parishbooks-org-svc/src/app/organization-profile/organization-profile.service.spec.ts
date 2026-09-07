import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationPlanTier } from '@parishbooks/database';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileService', () => {
    let service: OrganizationProfileService;
    let repository: { findByOrganizationId: jest.Mock; createProfile: jest.Mock };

    beforeEach(async () => {
        repository = {
            findByOrganizationId: jest.fn(),
            createProfile: jest.fn((input) => input),
        };

        const module = await Test.createTestingModule({
            providers: [OrganizationProfileService, { provide: OrganizationProfileRepository, useValue: repository }],
        }).compile();

        service = module.get(OrganizationProfileService);
    });

    it('throws ConflictException when a profile already exists', async () => {
        repository.findByOrganizationId.mockResolvedValue({ id: 'existing-profile' });

        await expect(service.create('org-1', { timezone: 'Asia/Kolkata' })).rejects.toThrow(ConflictException);
        expect(repository.createProfile).not.toHaveBeenCalled();
    });

    it('creates with planTier=starter regardless of caller input', async () => {
        repository.findByOrganizationId.mockResolvedValue(null);

        await service.create('org-1', { timezone: 'Asia/Kolkata' });

        expect(repository.createProfile).toHaveBeenCalledWith(
            expect.objectContaining({ organizationId: 'org-1', timezone: 'Asia/Kolkata', planTier: OrganizationPlanTier.STARTER }),
        );
    });
});
