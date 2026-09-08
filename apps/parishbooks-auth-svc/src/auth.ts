import { HttpService } from '@nestjs/axios';
import { HttpClientService, TransactionContext } from '@parishbooks/core';
import { betterAuthConfig } from './libs/auth.config';

const httpClient = new HttpClientService(new HttpService(), new TransactionContext());

export const auth = betterAuthConfig(
    {
        secret: process.env.BETTER_AUTH_SECRET || '',
        baseURL: process.env.BETTER_AUTH_URL || '',
        databaseURL: process.env.DATABASE_URL || '',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID || '',
        stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
        orgServiceUrl: process.env.ORG_SERVICE_URL || '',
        internalServiceKey: process.env.INTERNAL_SERVICE_KEY || '',
    },
    httpClient,
);
