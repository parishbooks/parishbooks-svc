import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { JwtClaims } from './auth.types';

export type Jwks = Parameters<typeof jwtVerify>[1];

export const buildRemoteJwks = (authServiceUrl: string): Jwks => createRemoteJWKSet(new URL('/api/auth/jwks', authServiceUrl));

/** Better Auth signs JWTs with `baseURL` (BETTER_AUTH_URL); services configure `AUTH_SERVICE_URL` with an `/api` suffix. */
export function resolveAuthJwtIssuer(authServiceUrl: string): string {
    return authServiceUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function stripApiSuffix(url: string): string {
    return url.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

/** Better Auth signs JWTs with `BETTER_AUTH_URL`; services often configure `AUTH_SERVICE_URL` with a different host alias. */
export function authJwtIssuers(authServiceUrl: string): string[] {
    const candidates = new Set<string>();
    candidates.add(resolveAuthJwtIssuer(authServiceUrl));
    const betterAuth = process.env.BETTER_AUTH_URL;
    if (betterAuth) candidates.add(stripApiSuffix(betterAuth));

    const withHostAliases = new Set<string>();
    for (const base of candidates) {
        withHostAliases.add(base);
        try {
            const parsed = new URL(base);
            const port = parsed.port ? `:${parsed.port}` : '';
            if (parsed.hostname === 'localhost') withHostAliases.add(`${parsed.protocol}//127.0.0.1${port}`);
            if (parsed.hostname === '127.0.0.1') withHostAliases.add(`${parsed.protocol}//localhost${port}`);
        } catch {
            /* keep base only */
        }
    }
    return [...withHostAliases];
}

export function looksLikeJwt(token: string): boolean {
    return token.split('.').length === 3;
}

export async function verifyAuthToken(token: string, jwks: Jwks, authServiceUrl: string): Promise<JwtClaims> {
    const issuers = authJwtIssuers(authServiceUrl);
    let lastError: unknown;
    for (const issuer of issuers) {
        try {
            const { payload } = await jwtVerify(token, jwks, { issuer, audience: issuer });
            return toJwtClaims(payload);
        } catch (error) {
            if (error instanceof Error && error.message.includes('missing required claims')) throw error;
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('JWT verification failed');
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
