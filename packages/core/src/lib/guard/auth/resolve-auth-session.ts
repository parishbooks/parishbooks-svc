/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
 * auth-svc status check. Used by {@link AuthGuard} on every protected route.
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
        const status = await checkSessionStatus(httpClient, authServiceUrl, configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY), claims.sessionId);
        if (!claims.sessionToken) return undefined;
        return isSessionValid(status, claims.organizationId) ? buildAuthSession(claims) : undefined;
    } catch {
        return undefined;
    }
}

function isSessionValid(status: SessionStatus, claimedOrganizationId: string | undefined): boolean {
    if (!status.active) return false;
    const claimed = claimedOrganizationId ?? null;
    if (status.activeOrganizationId !== claimed) return false;
    if (claimed === null) return true;
    return status.isMember;
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
        sessionToken: claims.sessionToken!,
    };
}
