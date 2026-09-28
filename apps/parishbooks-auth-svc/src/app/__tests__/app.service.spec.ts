jest.mock('../../auth', () => ({ auth: {} }));

import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { AppService } from '../app.service';

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

describe('AppService — JWT minting', () => {
    let service: AppService;
    let authService: { api: Record<string, jest.Mock> };

    beforeEach(async () => {
        authService = {
            api: {
                signInEmail: jest.fn(),
                signUpEmail: jest.fn(),
                setActiveOrganization: jest.fn(),
                getToken: jest.fn(),
            },
        };

        const module = await Test.createTestingModule({
            providers: [AppService, { provide: AuthService, useValue: authService }],
        }).compile();

        service = module.get(AppService);
    });

    it('signIn mints a JWT from the freshly established session and overwrites the response token', async () => {
        authService.api.signInEmail.mockResolvedValue({ redirect: false, token: 'opaque-session-token', user: { id: 'user-1' } });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.signIn({ email: 'jane@example.com', password: 'super-secret' });

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders.get('authorization')).toBe('Bearer opaque-session-token');
        expect(result).toEqual({ redirect: false, token: 'jwt-token', user: { id: 'user-1' } });
    });

    it('signUp mints a JWT when sign-up returns a session token', async () => {
        authService.api.signUpEmail.mockResolvedValue({ token: 'opaque-session-token', user: { id: 'user-1' } });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.signUp({ name: 'Jane', email: 'jane@example.com', password: 'super-secret' });

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders.get('authorization')).toBe('Bearer opaque-session-token');
        expect(result).toEqual({ token: 'jwt-token', user: { id: 'user-1' } });
    });

    it('signUp skips minting when no session is established (email verification required)', async () => {
        authService.api.signUpEmail.mockResolvedValue({ token: null, user: { id: 'user-1' } });

        const result = await service.signUp({ name: 'Jane', email: 'jane@example.com', password: 'super-secret' });

        expect(authService.api.getToken).not.toHaveBeenCalled();
        expect(result).toEqual({ token: null, user: { id: 'user-1' } });
    });

    it('setActiveOrganization re-mints a JWT reflecting the newly active organization', async () => {
        authService.api.setActiveOrganization.mockResolvedValue({ id: 'org-1', name: 'St. Mary Parish' });
        authService.api.getToken.mockResolvedValue({ token: 'new-jwt-token' });

        const result = await service.setActiveOrganization({ organizationId: 'org-1' }, 'opaque-session-token');

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders.get('authorization')).toBe('Bearer opaque-session-token');
        expect(result).toEqual({ id: 'org-1', name: 'St. Mary Parish', token: 'new-jwt-token' });
    });

    it('getToken delegates to the better-auth token endpoint with the caller headers', async () => {
        const headers = new Headers({ cookie: 'better-auth.session=abc' });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.getToken(headers);

        expect(authService.api.getToken).toHaveBeenCalledWith({ headers });
        expect(result).toEqual({ token: 'jwt-token' });
    });
});
