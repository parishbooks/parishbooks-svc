jest.mock('../auth', () => ({ auth: {} }));

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { HttpClientService } from '@parishbooks/core';
import { AppService } from './app.service';

describe('AppService#createOrganization', () => {
    let service: AppService;
    let authService: { api: { createOrganization: jest.Mock } };
    let httpClient: { post: jest.Mock };
    let configService: { getOrThrow: jest.Mock };

    const dto = { name: 'St. Mary Parish', slug: 'st-mary-parish', timezone: 'Asia/Kolkata' };
    const headers = new Headers({ authorization: 'Bearer token-123' });

    beforeEach(async () => {
        authService = { api: { createOrganization: jest.fn() } };
        httpClient = { post: jest.fn() };
        configService = { getOrThrow: jest.fn().mockReturnValue('http://localhost:3006') };

        const module = await Test.createTestingModule({
            providers: [
                AppService,
                { provide: AuthService, useValue: authService },
                { provide: HttpClientService, useValue: httpClient },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get(AppService);
    });

    it('creates the org-svc profile after BetterAuth creates the organization', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1', name: dto.name, slug: dto.slug });

        const result = await service.createOrganization(dto, headers);

        expect(httpClient.post).toHaveBeenCalledWith(
            'http://localhost:3006/api/organizations/org-1/profile',
            { timezone: 'Asia/Kolkata' },
            { headers: { Authorization: 'Bearer token-123', 'x-tenant-id': 'org-1' } },
        );
        expect(result).toEqual({ id: 'org-1', name: dto.name, slug: dto.slug });
    });

    it('propagates the failure when org-svc rejects the profile call', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1' });
        httpClient.post.mockRejectedValue(new Error('org-svc unreachable'));

        await expect(service.createOrganization(dto, headers)).rejects.toThrow('org-svc unreachable');
    });
});
