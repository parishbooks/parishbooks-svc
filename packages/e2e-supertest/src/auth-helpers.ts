import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { e2eConfig } from './env';

export type AuthenticatedUser = {
    email: string;
    name: string;
    token: string;
    userId: string;
    sessionId: string;
};

export function uniqueEmail(label: string): string {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `e2e-${slug}-${Date.now()}@parishbooks.test`;
}

function resolveAuthJwt(data: { token?: string | null }): string {
    const jwt = data.token;
    if (jwt && jwt.split('.').length === 3) return jwt;
    throw new Error('Missing JWT (token) on auth response');
}

async function markEmailVerified(email: string): Promise<void> {
    const client = new Client({ connectionString: e2eConfig.databaseUrl });
    await client.connect();
    try {
        await client.query('UPDATE auth."user" SET "emailVerified" = true WHERE email = $1', [email]);
    } finally {
        await client.end();
    }
}

async function findLatestSessionId(userId: string): Promise<string | null> {
    const client = new Client({ connectionString: e2eConfig.databaseUrl });
    await client.connect();
    try {
        const result = await client.query<{ id: string }>(
            'SELECT id FROM auth.session WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
            [userId],
        );
        return result.rows[0]?.id ?? null;
    } finally {
        await client.end();
    }
}

/** Register and sign in via Supertest against the auth app HTTP server. */
export async function registerAndSignIn(httpServer: App, label: string, email = uniqueEmail(label)): Promise<AuthenticatedUser> {
    const name = `E2E ${label}`;

    const signUp = await request(httpServer)
        .post('/api/identity/sign-up')
        .send({ email, password: e2eConfig.testPassword, name });
    if (signUp.status !== 201) throw new Error(`sign-up failed for ${email}: ${JSON.stringify(signUp.body)}`);
    await markEmailVerified(email);

    const signIn = await request(httpServer)
        .post('/api/identity/sign-in')
        .send({ email, password: e2eConfig.testPassword, rememberMe: false });
    if (signIn.status !== 200) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(signIn.body)}`);

    const userId = signIn.body.user.id as string;
    const sessionId = await findLatestSessionId(userId);
    if (!sessionId) throw new Error(`session row missing for ${email}`);

    return { email, name, token: resolveAuthJwt(signIn.body), userId, sessionId };
}

/** Reads the minted JWT from a sign-in / set-active-organization response body. */
export function resolveAuthJwtFromBody(data: { token?: string | null }): string {
    return resolveAuthJwt(data);
}
