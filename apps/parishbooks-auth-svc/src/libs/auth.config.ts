import { betterAuth } from 'better-auth';
import { bearer, organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../types/auth.types';
import { Pool } from 'pg';

const buildConnectionPool = (databaseURL: string) => {
    const options = `options=-c search_path=auth`;
    return new Pool({ connectionString: `${databaseURL}?${options}` });
};

export const betterAuthConfig = (config: BetterAuthConfig) => {
    return betterAuth({
        secret: config.secret,
        baseURL: config.baseURL,
        database: buildConnectionPool(config.databaseURL),
        advanced: { database: { joins: true } },
        emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 6 },
        socialProviders: {
            google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret },
        },
        plugins: [organization(), bearer()],
    });
};
