import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import Stripe from 'stripe';
import type { Stripe as StripeESM } from 'stripe' with { 'resolution-mode': 'import' };
import { HttpClientService, TransactionContext } from '@parishbooks/core';
import { BetterAuthConfig } from '../types/auth.types';
import { buildConnectionPool } from '../utils/auth.utils';
import { organizationPlugin } from './plugins/organization/organization.plugin';
import { emailOtpPlugin } from './plugins/email-otp/email-otp.plugin';
import { stripePlugin } from './plugins/stripe/stripe.plugin';
import { HttpService } from '@nestjs/axios';

export const betterAuthConfig = (config: BetterAuthConfig) => {
    const logger = new Logger('EmailOTP');
    const { googleClientId, googleClientSecret } = config;
    const pool = buildConnectionPool(config.databaseURL);
    const stripeClient = new Stripe(config.stripeSecretKey) as unknown as StripeESM;
    const httpClient = new HttpClientService(new HttpService(), new TransactionContext());

    return betterAuth({
        hooks: {},
        databaseHooks: {},
        secret: config.secret,
        baseURL: config.baseURL,
        database: pool,
        advanced: { database: { joins: true, generateId: 'uuid' } },
        emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 6 },
        socialProviders: { google: { clientId: googleClientId, clientSecret: googleClientSecret } },
        plugins: [organizationPlugin(config, httpClient), emailOtpPlugin(logger), stripePlugin(stripeClient, config, pool, httpClient), bearer()],
    });
};
