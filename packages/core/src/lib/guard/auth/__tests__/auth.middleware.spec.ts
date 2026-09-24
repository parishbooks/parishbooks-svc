import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthContext } from '../auth-context';
import { AuthMiddleware } from '../auth.middleware';
import * as jwtVerifier from '../jwt-verifier';
import * as sessionStatusClient from '../session-status.client';

jest.mock('../jwt-verifier');
jest.mock('../session-status.client');

function buildRequest(headers: Record<string, string>): Request {
    return { headers } as unknown as Request;
}

describe('AuthMiddleware', () => {
    let middleware: AuthMiddleware;
    let httpClient: { get: jest.Mock };
    let authContext: { run: jest.Mock };
    let configService: { getOrThrow: jest.Mock };
    let next: jest.Mock;

    beforeEach(() => {
        httpClient = { get: jest.fn() };
        authContext = { run: jest.fn((session, callback) => callback()) };
        configService = { getOrThrow: jest.fn((key: string) => (key === 'AUTH_SERVICE_URL' ? 'http://localhost:8001' : 'shared-secret')) };
        next = jest.fn();
        middleware = new AuthMiddleware(httpClient as never, authContext as unknown as AuthContext, configService as unknown as ConfigService);
        jest.mocked(jwtVerifier.buildRemoteJwks).mockReturnValue('fake-jwks' as never);
    });

    it('rejects a request with no Authorization header via next(err)', async () => {
        await middleware.use(buildRequest({}), {} as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
        expect(authContext.run).not.toHaveBeenCalled();
    });

    it('rejects when the session status check reports inactive', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: false, isMember: false, activeOrganizationId: null });

        await middleware.use(buildRequest({ authorization: 'Bearer good-token' }), {} as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
        expect(authContext.run).not.toHaveBeenCalled();
    });

    it('accepts a valid JWT with an active, matching session, enters it into AuthContext, and calls next()', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 's1',
            userId: 'u1',
            email: 'jane@example.com',
            name: 'Jane',
            emailVerified: true,
            organizationId: 'org-1',
            exp: 1893456000,
        });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' });

        await middleware.use(buildRequest({ authorization: 'Bearer good-token' }), {} as Response, next);

        expect(authContext.run).toHaveBeenCalledWith(
            {
                session: { id: 's1', userId: 'u1', expiresAt: new Date(1893456000 * 1000), activeOrganizationId: 'org-1' },
                user: { id: 'u1', email: 'jane@example.com', name: 'Jane', emailVerified: true },
            },
            next,
        );
        expect(next).toHaveBeenCalledWith();
    });
});
