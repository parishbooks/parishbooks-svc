import { betterAuthConfig } from './libs/auth.config';

export const auth = betterAuthConfig({
    secret: process.env.BETTER_AUTH_SECRET || '',
    baseURL: process.env.BETTER_AUTH_URL || '',
    databaseURL: process.env.DATABASE_URL || '',
});
