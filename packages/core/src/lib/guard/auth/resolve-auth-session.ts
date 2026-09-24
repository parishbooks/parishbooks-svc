import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '../../http/http-client.service';
import { INTERNAL_SERVICE_KEY_ENV_KEY } from '../internal/internal-service.constants';
import { AUTH_SERVICE_URL_ENV_KEY } from './auth.constants';
import { AuthSession, JwtClaims } from './auth.types';
import { buildRemoteJwks, Jwks, verifyAuthToken } from './jwt-verifier';
import { checkSessionStatus, SessionStatus } from './session-status.client';

/** Per-caller cache for the downstream auth-svc's JWKS, so repeated calls don't refetch it. */
export interface JwksCache {
    jwks?: Jwks;
}

export function extractBearerToken(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Verifies a caller's Bearer token as a locally-signed JWT (via auth-svc's
 * JWKS) and confirms the underlying session is still live via a lightweight
 * auth-svc status check. Shared by AuthGuard (the normal Nest guard path) and
 * AuthMiddleware (for routes a proxy middleware terminates before Nest's
 * guard chain would ever run) so both authenticate callers identically.
 */
export async function resolveAuthSession(
    httpClient: HttpClientService,
    configService: ConfigService,
    jwksCache: JwksCache,
    authorizationHeader: string | undefined,
): Promise<AuthSession | undefined> {
    const token = extractBearerToken(authorizationHeader);
    if (!token) return undefined;
    const authServiceUrl = configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
    try {
        jwksCache.jwks ??= buildRemoteJwks(authServiceUrl);
        const claims = await verifyAuthToken(token, jwksCache.jwks, authServiceUrl);
        const status = await checkSessionStatus(
            httpClient,
            authServiceUrl,
            configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY),
            claims.sessionId,
        );
        return isSessionValid(status, claims.organizationId) ? buildAuthSession(claims) : undefined;
    } catch {
        return undefined;
    }
}

function isSessionValid(status: SessionStatus, claimedOrganizationId: string | undefined): boolean {
    return status.active && status.isMember && status.activeOrganizationId === (claimedOrganizationId ?? null);
}

function buildAuthSession(claims: JwtClaims): AuthSession {
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
