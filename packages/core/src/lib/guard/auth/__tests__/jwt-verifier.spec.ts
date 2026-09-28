import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type JWK } from 'jose';
import { resolveAuthJwtIssuer, verifyAuthToken } from '../jwt-verifier';

describe('verifyAuthToken', () => {
    const issuer = 'http://localhost:8001';
    let jwks: ReturnType<typeof createLocalJWKSet>;
    let privateKey: CryptoKey;
    const kid = 'test-key';

    beforeAll(async () => {
        const { privateKey: priv, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        privateKey = priv;
        const publicJwk = await exportJWK(publicKey);
        jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid, alg: 'EdDSA' } as JWK] });
    });

    async function sign(claims: Record<string, unknown>, expiresIn = '10m'): Promise<string> {
        return new SignJWT(claims)
            .setProtectedHeader({ alg: 'EdDSA', kid })
            .setIssuedAt()
            .setIssuer(issuer)
            .setAudience(issuer)
            .setExpirationTime(expiresIn)
            .sign(privateKey);
    }

    it('returns claims from a validly signed token', async () => {
        const token = await sign({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            organizationId: 'org-1',
        });

        const claims = await verifyAuthToken(token, jwks, `${issuer}/api`);

        expect(claims).toMatchObject({
            sessionId: 'sess-1',
            sessionToken: 'opaque-session-token',
            userId: 'user-1',
            email: 'jane@example.com',
            organizationId: 'org-1',
        });
        expect(typeof claims.exp).toBe('number');
    });

    it('resolveAuthJwtIssuer strips a trailing /api from AUTH_SERVICE_URL', () => {
        expect(resolveAuthJwtIssuer('http://localhost:8001/api')).toBe('http://localhost:8001');
    });

    it('rejects a token signed for a different issuer', async () => {
        const token = await new SignJWT({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com' })
            .setProtectedHeader({ alg: 'EdDSA', kid })
            .setIssuedAt()
            .setIssuer('http://evil.example.com')
            .setAudience(issuer)
            .setExpirationTime('10m')
            .sign(privateKey);

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow();
    });

    it('rejects an expired token', async () => {
        const token = await sign({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com' }, '-10s');

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow();
    });

    it('rejects a token missing required claims', async () => {
        const token = await sign({ userId: 'user-1', email: 'jane@example.com' });

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow('missing required claims');
    });
});
