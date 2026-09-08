jest.mock('../auth', () => ({ auth: {} }));

import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';

describe('AppService#createOrganization', () => {
    let service: AppService;
    let authService: { api: { createOrganization: jest.Mock } };

    const dto = { name: 'St. Mary Parish', slug: 'st-mary-parish', timezone: 'Asia/Kolkata' };
    const headers = new Headers({ authorization: 'Bearer token-123' });

    beforeEach(async () => {
        authService = { api: { createOrganization: jest.fn() } };

        const module = await Test.createTestingModule({
            providers: [AppService, { provide: AuthService, useValue: authService }],
        }).compile();

        service = module.get(AppService);
    });

    it('folds timezone into organization metadata', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1', name: dto.name, slug: dto.slug });

        const result = await service.createOrganization(dto, headers);

        expect(authService.api.createOrganization).toHaveBeenCalledWith({
            body: { name: dto.name, slug: dto.slug, metadata: { timezone: 'Asia/Kolkata' } },
            headers,
        });
        expect(result).toEqual({ id: 'org-1', name: dto.name, slug: dto.slug });
    });

    it('propagates a failure from BetterAuth', async () => {
        authService.api.createOrganization.mockRejectedValue(new Error('slug already exists'));

        await expect(service.createOrganization(dto, headers)).rejects.toThrow('slug already exists');
    });
});
