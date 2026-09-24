import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IncomingMessage } from 'node:http';
import { HttpClientService } from '../../http/http-client.service';
import { AuthContext } from './auth-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwksCache, resolveAuthSession } from './resolve-auth-session';

/**
 * Verifies the caller's Bearer token as a locally-signed JWT (via auth-svc's
 * JWKS) and confirms the underlying session is still live via a lightweight
 * auth-svc status check, making the resolved session available to the rest
 * of the request via AuthContext. Apply directly in each consuming app's own
 * AppModule:
 *
 *   providers: [AuthContext, { provide: APP_GUARD, useClass: AuthGuard }]
 *
 * Routes (or whole controllers) decorated with @Public() are skipped.
 * Requires AUTH_SERVICE_URL and INTERNAL_SERVICE_KEY in the app's config
 * (ConfigModule must be registered) and HttpClientModule.forRoot() imported
 * for HttpClientService.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    private readonly jwksCache: JwksCache = {};

    constructor(
        private readonly httpClient: HttpClientService,
        private readonly authContext: AuthContext,
        private readonly configService: ConfigService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;

        const req = context.switchToHttp().getRequest<IncomingMessage>();
        const session = await resolveAuthSession(this.httpClient, this.configService, this.jwksCache, req.headers.authorization);
        if (!session) throw new UnauthorizedException();
        this.authContext.enterWith(session);
        return true;
    }
}
