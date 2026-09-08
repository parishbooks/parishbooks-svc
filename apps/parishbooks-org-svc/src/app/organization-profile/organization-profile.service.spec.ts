import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationPlanTier } from '@parishbooks/database';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileService', () => {
    let service: OrganizationProfileService;
    let repository: { findByOrganizationId: jest.Mock; createProfile: jest.Mock; updateProfile: jest.Mock };

    beforeEach(async () => {
        repository = {
            findByOrganizationId: jest.fn(),
            createProfile: jest.fn((input) => input),
            updateProfile: jest.fn((id, input) => ({ id, ...input })),
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

    it('throws NotFoundException when fetching a profile that does not exist', async () => {
        repository.findByOrganizationId.mockResolvedValue(null);

        await expect(service.findByOrganizationId('org-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the profile when it exists', async () => {
        const profile = { id: 'profile-1', organizationId: 'org-1' };
        repository.findByOrganizationId.mockResolvedValue(profile);

        await expect(service.findByOrganizationId('org-1')).resolves.toBe(profile);
    });

    it('throws NotFoundException when updating a profile that does not exist', async () => {
        repository.findByOrganizationId.mockResolvedValue(null);

        await expect(service.update('org-1', { timezone: 'America/New_York' })).rejects.toThrow(NotFoundException);
        expect(repository.updateProfile).not.toHaveBeenCalled();
    });

    it('updates only the fields provided', async () => {
        repository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', organizationId: 'org-1', timezone: 'Asia/Kolkata' });

        await service.update('org-1', { timezone: 'America/New_York' });

        expect(repository.updateProfile).toHaveBeenCalledWith('profile-1', { timezone: 'America/New_York' });
    });
});
