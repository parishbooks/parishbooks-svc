import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { JwtClaims } from './auth.types';

export type Jwks = Parameters<typeof jwtVerify>[1];

export const buildRemoteJwks = (authServiceUrl: string): Jwks => createRemoteJWKSet(new URL('/api/auth/jwks', authServiceUrl));

/** Better Auth signs JWTs with `baseURL` (BETTER_AUTH_URL); services configure `AUTH_SERVICE_URL` with an `/api` suffix. */
export function resolveAuthJwtIssuer(authServiceUrl: string): string {
    return authServiceUrl.replace(/\/api\/?$/, '');
}

export function looksLikeJwt(token: string): boolean {
    return token.split('.').length === 3;
}

export async function verifyAuthToken(token: string, jwks: Jwks, authServiceUrl: string): Promise<JwtClaims> {
    const issuer = resolveAuthJwtIssuer(authServiceUrl);
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: issuer });
    return toJwtClaims(payload);
}

function toJwtClaims(payload: JWTPayload): JwtClaims {
    const claims = payload as Record<string, unknown>;
    const { sessionId, userId, email, exp } = claims;
    if (typeof sessionId !== 'string' || typeof userId !== 'string' || typeof email !== 'string' || typeof exp !== 'number') {
        throw new Error('JWT payload is missing required claims');
    }
    return {
        sessionId,
        sessionToken: typeof claims.sessionToken === 'string' ? claims.sessionToken : undefined,
        userId,
        email,
        exp,
        name: typeof claims.name === 'string' ? claims.name : undefined,
        emailVerified: typeof claims.emailVerified === 'boolean' ? claims.emailVerified : undefined,
        organizationId: typeof claims.organizationId === 'string' ? claims.organizationId : undefined,
    };
}
