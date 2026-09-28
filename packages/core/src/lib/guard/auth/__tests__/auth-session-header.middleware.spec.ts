import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { SESSION_TOKEN_HEADER } from '../auth.constants';
import { AuthProxySessionHeaderMiddleware, AuthSessionHeaderMiddleware } from '../auth-session-header.middleware';
import * as jwtVerifier from '../jwt-verifier';

jest.mock('../jwt-verifier');

describe('AuthProxySessionHeaderMiddleware', () => {
    let middleware: AuthProxySessionHeaderMiddleware;
    let configService: { getOrThrow: jest.Mock };
    let next: jest.Mock<NextFunction>;

    beforeEach(() => {
        configService = { getOrThrow: jest.fn().mockReturnValue('http://localhost:8001/api') };
        middleware = new AuthProxySessionHeaderMiddleware(configService as unknown as ConfigService);
        next = jest.fn();
        jest.mocked(jwtVerifier.buildRemoteJwks).mockReturnValue('fake-jwks' as never);
        jest.mocked(jwtVerifier.looksLikeJwt).mockImplementation((token) => token.split('.').length === 3);
    });

    it('sets x-session-token and keeps Authorization as the JWT', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            exp: 9999999999,
        });
        const req = { headers: { authorization: 'Bearer header.payload.sig' } } as Request;

        await middleware.use(req, {} as Response, next);

        expect(req.headers.authorization).toBe('Bearer header.payload.sig');
        expect(req.headers[SESSION_TOKEN_HEADER]).toBe('opaque-session-token');
        expect(next).toHaveBeenCalledWith();
    });

    it('strips a client-supplied x-session-token before applying a verified one', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            exp: 9999999999,
        });
        const req = { headers: { authorization: 'Bearer header.payload.sig', [SESSION_TOKEN_HEADER]: 'forged' } } as Request;

        await middleware.use(req, {} as Response, next);

        expect(req.headers[SESSION_TOKEN_HEADER]).toBe('opaque-session-token');
    });
});

describe('AuthSessionHeaderMiddleware', () => {
    let middleware: AuthSessionHeaderMiddleware;
    let next: jest.Mock<NextFunction>;

    beforeEach(() => {
        middleware = new AuthSessionHeaderMiddleware({ getOrThrow: () => 'http://localhost:8001/api' } as ConfigService);
        next = jest.fn();
        jest.mocked(jwtVerifier.buildRemoteJwks).mockReturnValue('fake-jwks' as never);
        jest.mocked(jwtVerifier.looksLikeJwt).mockImplementation((token) => token.split('.').length === 3);
    });

    it('passes through when x-session-token is absent', async () => {
        const req = { headers: { authorization: 'Bearer opaque-session-token' } } as Request;

        await middleware.use(req, {} as Response, next);

        expect(req.headers.authorization).toBe('Bearer opaque-session-token');
        expect(next).toHaveBeenCalledWith();
    });

    it('maps a verified x-session-token to Authorization for Better Auth', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            exp: 9999999999,
        });
        const req = {
            headers: { authorization: 'Bearer header.payload.sig', [SESSION_TOKEN_HEADER]: 'opaque-session-token' },
        } as Request;

        await middleware.use(req, {} as Response, next);

        expect(req.headers.authorization).toBe('Bearer opaque-session-token');
        expect(req.headers[SESSION_TOKEN_HEADER]).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
    });

    it('rejects when x-session-token does not match the JWT claim', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            exp: 9999999999,
        });
        const req = {
            headers: { authorization: 'Bearer header.payload.sig', [SESSION_TOKEN_HEADER]: 'wrong-token' },
        } as Request;

        await middleware.use(req, {} as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
});
