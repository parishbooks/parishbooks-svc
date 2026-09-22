import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthContext } from '@parishbooks/core';
import { OrganizationOnboardingController } from '../organization-onboarding.controller';
import { OrganizationOnboardingService } from '../organization-onboarding.service';

describe('OrganizationOnboardingController', () => {
    let controller: OrganizationOnboardingController;
    let service: { submit: jest.Mock; getStatus: jest.Mock };
    let authContext: { getUser: jest.Mock; getSession: jest.Mock };

    beforeEach(async () => {
        service = { submit: jest.fn(), getStatus: jest.fn() };
        authContext = {
            getUser: jest.fn().mockReturnValue({ id: 'user-1' }),
            getSession: jest.fn().mockReturnValue({ session: { activeOrganizationId: 'org-1' } }),
        };
        const module = await Test.createTestingModule({
            controllers: [OrganizationOnboardingController],
            providers: [
                { provide: OrganizationOnboardingService, useValue: service },
                { provide: AuthContext, useValue: authContext },
            ],
        }).compile();

        controller = module.get(OrganizationOnboardingController);
    });

    it('rejects submit when organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.submit('org-1', 'org-2', { businessName: 'Church' } as never)).toThrow(BadRequestException);
        expect(service.submit).not.toHaveBeenCalled();
    });

    it('delegates submit to the service with the authenticated user id', async () => {
        service.submit.mockResolvedValue({ organizationId: 'org-1', vendorStatus: 'pending' });

        const result = await controller.submit('org-1', 'org-1', { businessName: 'Church' } as never);

        expect(service.submit).toHaveBeenCalledWith('org-1', 'user-1', { businessName: 'Church' });
        expect(result).toEqual({ organizationId: 'org-1', vendorStatus: 'pending' });
    });

    it('rejects submit when there is no authenticated user in context', () => {
        authContext.getUser.mockReturnValue(undefined);

        expect(() => controller.submit('org-1', 'org-1', { businessName: 'Church' } as never)).toThrow(BadRequestException);
        expect(service.submit).not.toHaveBeenCalled();
    });

    it('rejects submit when the path/header organizationId does not match the session\'s organization', () => {
        authContext.getSession.mockReturnValue({ session: { activeOrganizationId: 'org-2' } });

        expect(() => controller.submit('org-1', 'org-1', { businessName: 'Church' } as never)).toThrow(ForbiddenException);
        expect(service.submit).not.toHaveBeenCalled();
    });

    it('rejects status fetch when organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.status('org-1', 'org-2')).toThrow(BadRequestException);
        expect(service.getStatus).not.toHaveBeenCalled();
    });

    it('rejects status fetch when the path/header organizationId does not match the session\'s organization', () => {
        authContext.getSession.mockReturnValue({ session: { activeOrganizationId: 'org-2' } });

        expect(() => controller.status('org-1', 'org-1')).toThrow(ForbiddenException);
        expect(service.getStatus).not.toHaveBeenCalled();
    });

    it('delegates status fetch to the service', async () => {
        service.getStatus.mockResolvedValue({ organizationId: 'org-1', vendorStatus: 'active' });

        const result = await controller.status('org-1', 'org-1');

        expect(service.getStatus).toHaveBeenCalledWith('org-1');
        expect(result).toEqual({ organizationId: 'org-1', vendorStatus: 'active' });
    });
});
