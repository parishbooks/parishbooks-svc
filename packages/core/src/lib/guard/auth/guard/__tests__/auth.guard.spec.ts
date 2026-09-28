import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthContext } from '../../context/auth-context';
import { AuthGuard } from '../auth.guard';
import * as jwtVerifier from '../../jwt/jwt-verifier';
import * as sessionStatusClient from '../../session/session-status.client';

jest.mock('../../jwt/jwt-verifier');
jest.mock('../../session/session-status.client');

function buildContext(headers: Record<string, string>): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let httpClient: { get: jest.Mock };
    let authContext: { enterWith: jest.Mock };
    let configService: { getOrThrow: jest.Mock };
    let reflector: { getAllAndOverride: jest.Mock };

    beforeEach(() => {
        httpClient = { get: jest.fn() };
        authContext = { enterWith: jest.fn() };
        configService = { getOrThrow: jest.fn((key: string) => (key === 'AUTH_SERVICE_URL' ? 'http://localhost:8001' : 'shared-secret')) };
        reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
        guard = new AuthGuard(
            httpClient as never,
            authContext as unknown as AuthContext,
            configService as unknown as ConfigService,
            reflector as unknown as Reflector,
        );
        jest.mocked(jwtVerifier.buildRemoteJwks).mockReturnValue('fake-jwks' as never);
    });

    it('allows a @Public route without checking the token', async () => {
        reflector.getAllAndOverride.mockReturnValue(true);

        const result = await guard.canActivate(buildContext({}));

        expect(result).toBe(true);
        expect(authContext.enterWith).not.toHaveBeenCalled();
    });

    it('rejects a request with no Authorization header', async () => {
        await expect(guard.canActivate(buildContext({}))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a request with a malformed Authorization header', async () => {
        await expect(guard.canActivate(buildContext({ authorization: 'not-bearer token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the JWT fails verification', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockRejectedValue(new Error('bad signature'));

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer bad-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the session status check reports inactive', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', sessionToken: 'opaque', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: false, isMember: false, activeOrganizationId: null });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the JWT organizationId claim does not match the live session', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', sessionToken: 'opaque', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-2' });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the caller is no longer a member of the claimed org', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', sessionToken: 'opaque', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: false, activeOrganizationId: 'org-1' });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a valid JWT with an active, matching session and enters the resolved AuthSession into AuthContext', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 's1',
            sessionToken: 'opaque-session',
            userId: 'u1',
            email: 'jane@example.com',
            name: 'Jane',
            emailVerified: true,
            organizationId: 'org-1',
            exp: 1893456000,
        });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' });

        const result = await guard.canActivate(buildContext({ authorization: 'Bearer good-token' }));

        expect(result).toBe(true);
        expect(authContext.enterWith).toHaveBeenCalledWith({
            session: { id: 's1', userId: 'u1', expiresAt: new Date(1893456000 * 1000), activeOrganizationId: 'org-1' },
            user: { id: 'u1', email: 'jane@example.com', name: 'Jane', emailVerified: true },
            sessionToken: 'opaque-session',
        });
    });
});
