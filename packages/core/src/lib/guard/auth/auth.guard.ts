import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IncomingMessage } from 'node:http';
import { HttpClientService } from '../../http/http-client.service';
import { INTERNAL_SERVICE_KEY_ENV_KEY } from '../internal/internal-service.constants';
import { AuthContext } from './auth-context';
import { AUTH_SERVICE_URL_ENV_KEY } from './auth.constants';
import { AuthSession, JwtClaims } from './auth.types';
import { buildRemoteJwks, Jwks, verifyAuthToken } from './jwt-verifier';
import { IS_PUBLIC_KEY } from './public.decorator';
import { checkSessionStatus, SessionStatus } from './session-status.client';

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
    private jwks: Jwks | undefined;

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
        const session = token ? await this.resolveSession(token) : undefined;
        if (!session) throw new UnauthorizedException();
        this.authContext.enterWith(session);
        return true;
    }

    private extractBearerToken(header?: string): string | undefined {
        if (!header) return undefined;
        const [scheme, token] = header.split(' ');
        return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
    }

    private async resolveSession(token: string): Promise<AuthSession | undefined> {
        const authServiceUrl = this.configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
        try {
            const claims = await verifyAuthToken(token, this.getJwks(authServiceUrl), authServiceUrl);
            const status = await checkSessionStatus(
                this.httpClient,
                authServiceUrl,
                this.configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY),
                claims.sessionId,
            );
            return this.isSessionValid(status, claims.organizationId) ? this.buildAuthSession(claims) : undefined;
        } catch {
            return undefined;
        }
    }

    private getJwks(authServiceUrl: string): Jwks {
        this.jwks ??= buildRemoteJwks(authServiceUrl);
        return this.jwks;
    }

    private isSessionValid(status: SessionStatus, claimedOrganizationId: string | undefined): boolean {
        return status.active && status.isMember && status.activeOrganizationId === (claimedOrganizationId ?? null);
    }

    private buildAuthSession(claims: JwtClaims): AuthSession {
        return {
            session: {
                id: claims.sessionId,
                userId: claims.userId,
                expiresAt: new Date(claims.exp * 1000),
                activeOrganizationId: claims.organizationId,
            },
            user: {
                id: claims.userId,
                email: claims.email,
                name: claims.name,
                emailVerified: claims.emailVerified,
            },
        };
    }
}
