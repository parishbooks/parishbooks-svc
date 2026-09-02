import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IncomingMessage } from 'node:http';
import { HttpClientService } from '../../http/http-client.service';
import { AuthContext } from './auth-context';
import { AUTH_SERVICE_URL_ENV_KEY, AUTH_SESSION_PATH_ENV_KEY, DEFAULT_SESSION_PATH } from './auth.constants';
import { AuthSession } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Validates the caller's bearer token against auth-svc's session endpoint and
 * makes the resolved session available to the rest of the request via
 * AuthContext. Apply directly in each consuming app's own AppModule:
 *
 *   providers: [AuthContext, { provide: APP_GUARD, useClass: AuthGuard }]
 *
 * Routes (or whole controllers) decorated with @Public() are skipped.
 * Requires AUTH_SERVICE_URL in the app's config (ConfigModule must be
 * registered) and HttpClientModule.forRoot() imported for HttpClientService.
 */
@Injectable()
export class AuthGuard implements CanActivate {
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
        const token = this.extractBearerToken(req.headers.authorization);
        const session = token ? await this.validateToken(token) : undefined;
        if (!session) throw new UnauthorizedException();
        this.authContext.enterWith(session);
        return true;
    }

    private extractBearerToken(header?: string): string | undefined {
        if (!header) return undefined;
        const [scheme, token] = header.split(' ');
        return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
    }

    private async validateToken(token: string): Promise<AuthSession | undefined> {
        const authServiceUrl = this.configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
        const sessionPath = this.configService.get<string>(AUTH_SESSION_PATH_ENV_KEY, DEFAULT_SESSION_PATH);

        try {
            return await this.httpClient.get<AuthSession>(`${authServiceUrl}${sessionPath}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            return undefined;
        }
    }
}
