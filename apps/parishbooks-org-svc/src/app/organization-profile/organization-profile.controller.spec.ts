import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthContext } from '@parishbooks/core';
import { OrganizationBillingStatus } from '@parishbooks/database';
import { SyncBillingDto } from './dto/sync-billing.dto';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileController', () => {
    let controller: OrganizationProfileController;
    let service: { create: jest.Mock; findByOrganizationId: jest.Mock; update: jest.Mock; syncBilling: jest.Mock };
    let authContext: { getSession: jest.Mock };

    beforeEach(async () => {
        service = { create: jest.fn(), findByOrganizationId: jest.fn(), update: jest.fn(), syncBilling: jest.fn() };
        authContext = { getSession: jest.fn().mockReturnValue({ session: { activeOrganizationId: 'org-1' } }) };
        const module = await Test.createTestingModule({
            controllers: [OrganizationProfileController],
            providers: [
                { provide: OrganizationProfileService, useValue: service },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
                { provide: AuthContext, useValue: authContext },
            ],
        }).compile();

        controller = module.get(OrganizationProfileController);
    });

    it('rejects when the organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.create('org-1', 'org-2', { timezone: 'Asia/Kolkata' })).toThrow(BadRequestException);
        expect(service.create).not.toHaveBeenCalled();
    });

    it('delegates to the service when ids match, without requiring a session (internal-service call)', async () => {
        service.create.mockResolvedValue({ id: 'profile-1' });
        authContext.getSession.mockReturnValue(undefined);

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

    it('rejects fetch when the path/header organizationId does not match the session\'s organization', () => {
        authContext.getSession.mockReturnValue({ session: { activeOrganizationId: 'org-2' } });

        expect(() => controller.findOne('org-1', 'org-1')).toThrow(ForbiddenException);
        expect(service.findByOrganizationId).not.toHaveBeenCalled();
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

    it('rejects update when the path/header organizationId does not match the session\'s organization', () => {
        authContext.getSession.mockReturnValue({ session: { activeOrganizationId: 'org-2' } });

        expect(() => controller.update('org-1', 'org-1', { timezone: 'America/New_York' })).toThrow(ForbiddenException);
        expect(service.update).not.toHaveBeenCalled();
    });

    it('delegates billing sync to the service without a tenant-header check', async () => {
        service.syncBilling.mockResolvedValue({ id: 'profile-1', billingStatus: 'pastDue' });

        const result = await controller.syncBilling('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE } as SyncBillingDto);

        expect(service.syncBilling).toHaveBeenCalledWith('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE });
        expect(result).toEqual({ id: 'profile-1', billingStatus: 'pastDue' });
    });
});
