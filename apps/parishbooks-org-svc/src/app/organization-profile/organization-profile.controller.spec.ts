import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileController', () => {
    let controller: OrganizationProfileController;
    let service: { create: jest.Mock; findByOrganizationId: jest.Mock; update: jest.Mock };

    beforeEach(async () => {
        service = { create: jest.fn(), findByOrganizationId: jest.fn(), update: jest.fn() };
        const module = await Test.createTestingModule({
            controllers: [OrganizationProfileController],
            providers: [{ provide: OrganizationProfileService, useValue: service }],
        }).compile();

        controller = module.get(OrganizationProfileController);
    });

    it('rejects when the organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.create('org-1', 'org-2', { timezone: 'Asia/Kolkata' })).toThrow(BadRequestException);
        expect(service.create).not.toHaveBeenCalled();
    });

    it('delegates to the service when ids match', async () => {
        service.create.mockResolvedValue({ id: 'profile-1' });

        const result = await controller.create('org-1', 'org-1', { timezone: 'Asia/Kolkata' });

        expect(service.create).toHaveBeenCalledWith('org-1', { timezone: 'Asia/Kolkata' });
        expect(result).toEqual({ id: 'profile-1' });
    });

    it('rejects fetch when the organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.findOne('org-1', 'org-2')).toThrow(BadRequestException);
        expect(service.findByOrganizationId).not.toHaveBeenCalled();
    });

    it('delegates fetch to the service when ids match', async () => {
        service.findByOrganizationId.mockResolvedValue({ id: 'profile-1' });

        const result = await controller.findOne('org-1', 'org-1');

        expect(service.findByOrganizationId).toHaveBeenCalledWith('org-1');
        expect(result).toEqual({ id: 'profile-1' });
    });

    it('rejects update when the organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.update('org-1', 'org-2', { timezone: 'America/New_York' })).toThrow(BadRequestException);
        expect(service.update).not.toHaveBeenCalled();
    });

    it('delegates update to the service when ids match', async () => {
        service.update.mockResolvedValue({ id: 'profile-1', timezone: 'America/New_York' });

        const result = await controller.update('org-1', 'org-1', { timezone: 'America/New_York' });

        expect(service.update).toHaveBeenCalledWith('org-1', { timezone: 'America/New_York' });
        expect(result).toEqual({ id: 'profile-1', timezone: 'America/New_York' });
    });
});
