import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { HttpClientService } from '../../http/http-client.service';
import { AuthContext } from './auth-context';
import { JwksCache, resolveAuthSession } from './resolve-auth-session';

/**
 * Middleware equivalent of AuthGuard, for routes handled entirely by a proxy
 * middleware (e.g. the gateway's per-service reverse proxies). Nest's guard
 * chain never runs for such routes because the proxy middleware terminates
 * the response itself before Nest's router would dispatch to a controller,
 * so authentication has to happen in the middleware chain instead. Apply it
 * ahead of the proxy middleware in the same `consumer.apply(...)` call so
 * AuthContext is populated before the request is forwarded downstream:
 *
 *   consumer.apply(AuthMiddleware, proxyMiddleware).forRoutes('org');
 *
 * There is no @Public() support here (middleware runs before Nest resolves a
 * route handler, so there is no handler/class to read the decorator from) —
 * skip applying this middleware for prefixes that must stay unauthenticated.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
    private readonly jwksCache: JwksCache = {};

    constructor(
        private readonly httpClient: HttpClientService,
        private readonly authContext: AuthContext,
        private readonly configService: ConfigService,
    ) {}

    use = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const session = await resolveAuthSession(this.httpClient, this.configService, this.jwksCache, req.headers.authorization);
            if (!session) throw new UnauthorizedException();
            this.authContext.run(session, next);
        } catch (error) {
            next(error);
        }
    };
}
