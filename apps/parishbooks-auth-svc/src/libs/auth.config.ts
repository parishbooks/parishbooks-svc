import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { bearer, emailOTP, organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../types/auth.types';
import { buildConnectionPool } from '../utils/auth.utils';

const logger = new Logger('EmailOTP');

export const betterAuthConfig = (config: BetterAuthConfig) => {
    const { googleClientId, googleClientSecret } = config;
    return betterAuth({
        hooks: {},
        databaseHooks: {},
        secret: config.secret,
        baseURL: config.baseURL,
        database: buildConnectionPool(config.databaseURL),
        advanced: { database: { joins: true, generateId: 'uuid' } },
        emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 6 },
        socialProviders: { google: { clientId: googleClientId, clientSecret: googleClientSecret } },
        plugins: [
            organization({ invitationLimit: 1, allowUserToCreateOrganization: true, organizationHooks: {} }),
            bearer(),
            emailOTP({
                otpLength: 6,
                overrideDefaultEmailVerification: true,
                sendVerificationOnSignUp: true,
                sendVerificationOTP: async ({ email, otp, type }) => {
                    logger.log(`OTP ${otp} for ${email} (${type})`);
                },
            }),
        ],
    });
};
