import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_SERVICE_URL_ENV_KEY, SESSION_TOKEN_HEADER } from './auth.constants';
import { buildRemoteJwks, looksLikeJwt, verifyAuthToken } from './jwt-verifier';
import { extractBearerToken, JwksCache } from './resolve-auth-session';

/**
 * Gateway: verifies the caller's JWT and sets `x-session-token` for the auth-svc
 * upstream. Leaves `Authorization` as the JWT. Strips any client-supplied
 * session header first.
 */
@Injectable()
export class AuthProxySessionHeaderMiddleware implements NestMiddleware {
    private readonly jwksCache: JwksCache = {};

    constructor(private readonly configService: ConfigService) {}

    use = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        delete req.headers[SESSION_TOKEN_HEADER];
        const bearer = extractBearerToken(req.headers.authorization);
        if (!bearer || !looksLikeJwt(bearer)) return next();

        const authServiceUrl = this.configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
        try {
            this.jwksCache.jwks ??= buildRemoteJwks(authServiceUrl);
            const claims = await verifyAuthToken(bearer, this.jwksCache.jwks, authServiceUrl);
            if (!claims.sessionToken) return next(new UnauthorizedException());
            req.headers[SESSION_TOKEN_HEADER] = claims.sessionToken;
            next();
        } catch {
            next(new UnauthorizedException());
        }
    };
}

/**
 * auth-svc: when the gateway (or any trusted caller) sends `x-session-token` with
 * a JWT in `Authorization`, verify the JWT and confirm the header matches the
 * embedded session claim, then expose the opaque token to Better Auth via
 * `Authorization`. Opaque-only callers (e2e direct) pass through unchanged.
 */
@Injectable()
export class AuthSessionHeaderMiddleware implements NestMiddleware {
    private readonly jwksCache: JwksCache = {};

    constructor(private readonly configService: ConfigService) {}

    use = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        const sessionToken = req.headers[SESSION_TOKEN_HEADER];
        if (typeof sessionToken !== 'string' || !sessionToken) return next();

        const bearer = extractBearerToken(req.headers.authorization);
        if (!bearer || !looksLikeJwt(bearer)) return next(new UnauthorizedException());

        const authServiceUrl = this.configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
        try {
            this.jwksCache.jwks ??= buildRemoteJwks(authServiceUrl);
            const claims = await verifyAuthToken(bearer, this.jwksCache.jwks, authServiceUrl);
            if (!claims.sessionToken || claims.sessionToken !== sessionToken) return next(new UnauthorizedException());
            req.headers.authorization = `Bearer ${sessionToken}`;
            delete req.headers[SESSION_TOKEN_HEADER];
            next();
        } catch {
            next(new UnauthorizedException());
        }
    };
}
