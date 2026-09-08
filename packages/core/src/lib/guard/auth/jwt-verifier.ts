import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { JwtClaims } from './auth.types';

export type Jwks = ReturnType<typeof createRemoteJWKSet>;

export const buildRemoteJwks = (authServiceUrl: string): Jwks => createRemoteJWKSet(new URL('/api/auth/jwks', authServiceUrl));

export async function verifyAuthToken(token: string, jwks: Jwks, authServiceUrl: string): Promise<JwtClaims> {
    const { payload } = await jwtVerify(token, jwks, { issuer: authServiceUrl, audience: authServiceUrl });
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
        userId,
        email,
        exp,
        name: typeof claims.name === 'string' ? claims.name : undefined,
        emailVerified: typeof claims.emailVerified === 'boolean' ? claims.emailVerified : undefined,
        organizationId: typeof claims.organizationId === 'string' ? claims.organizationId : undefined,
    };
}
