import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileController', () => {
    let controller: OrganizationProfileController;
    let service: { create: jest.Mock };

    beforeEach(async () => {
        service = { create: jest.fn() };
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
});
