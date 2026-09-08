import { Logger } from '@nestjs/common';
import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { bearer, emailOTP, organization } from 'better-auth/plugins';
import Stripe from 'stripe';
import { HttpClientService } from '@parishbooks/core';
import { BetterAuthConfig } from '../types/auth.types';
import { authorizeOrganizationBillingReference, buildConnectionPool, syncOrgBilling } from '../utils/auth.utils';

const logger = new Logger('EmailOTP');
const billingLogger = new Logger('StripeBilling');

export const betterAuthConfig = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    const { googleClientId, googleClientSecret } = config;
    const pool = buildConnectionPool(config.databaseURL);
    const stripeClient = new Stripe(config.stripeSecretKey);
    const syncBilling = syncOrgBilling(config, httpClient);

    return betterAuth({
        hooks: {},
        databaseHooks: {},
        secret: config.secret,
        baseURL: config.baseURL,
        database: pool,
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
            stripe({
                stripeClient,
                stripeWebhookSecret: config.stripeWebhookSecret,
                createCustomerOnSignUp: true,
                subscription: {
                    enabled: true,
                    plans: [
                        { name: 'starter', priceId: config.stripeStarterPriceId },
                        { name: 'pro', priceId: config.stripeProPriceId },
                    ],
                    authorizeReference: authorizeOrganizationBillingReference(pool),
                    onSubscriptionUpdate: async ({ subscription }) => {
                        await syncBilling(subscription.referenceId, { plan: subscription.plan, status: subscription.status });
                    },
                    // Fires once when a still-active subscription is scheduled to cancel at
                    // period end (cancel_at_period_end). The subscription is NOT canceled yet
                    // — onSubscriptionUpdate has already run (and will run again on the actual
                    // cancellation), so this is log-only and must never call syncBilling with
                    // status: 'canceled' here.
                    onSubscriptionCancel: async ({ subscription }) => {
                        billingLogger.log(`Subscription for organization ${subscription.referenceId} is scheduled to cancel at period end`);
                    },
                    // Fires on the actual customer.subscription.deleted event — this is when
                    // the subscription has truly ended and billingStatus should flip to
                    // canceled.
                    onSubscriptionDeleted: async ({ subscription }) => {
                        await syncBilling(subscription.referenceId, { plan: subscription.plan, status: 'canceled' });
                    },
                },
                organization: { enabled: true },
            }),
        ],
    });
};
