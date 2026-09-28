import { Client } from 'pg';
import { resolveAuthSessionBearer } from './auth-session-token';
import { e2eConfig } from './e2e-config';
import { api } from './http-client';

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

export async function markEmailVerified(email: string): Promise<void> {
    const client = new Client({ connectionString: e2eConfig.databaseUrl });
    await client.connect();
    try {
        await client.query('UPDATE auth."user" SET "emailVerified" = true WHERE email = $1', [email]);
    } finally {
        await client.end();
    }
}

export async function registerAndSignIn(label: string, email = uniqueEmail(label)): Promise<AuthenticatedUser> {
    const name = `E2E ${label}`;

    const signUp = await api.post('/identity/sign-up', { email, password: e2eConfig.testPassword, name });
    if (signUp.status !== 201) throw new Error(`sign-up failed for ${email}: ${JSON.stringify(signUp.data)}`);
    await markEmailVerified(email);

    const signIn = await api.post('/identity/sign-in', { email, password: e2eConfig.testPassword, rememberMe: false });
    if (signIn.status !== 200) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(signIn.data)}`);

    const userId = signIn.data.user.id as string;
    const sessionId = await findLatestSessionId(userId);
    if (!sessionId) throw new Error(`session row missing for ${email}`);

    return {
        email,
        name,
        token: resolveAuthSessionBearer(signIn.data),
        userId,
        sessionId,
    };
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
