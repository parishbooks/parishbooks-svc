import { stripe } from '@better-auth/stripe';
import type { Stripe as StripeESM } from 'stripe' with { 'resolution-mode': 'import' };
import { BetterAuthConfig } from '../../../types/auth.types';
import { authorizeOrganizationBillingReference } from '../../../utils/auth.utils';
import { HttpClientService } from '@parishbooks/core';
import { StripeUtils } from './stripe.utils';
import { Pool } from 'pg';

const stripePlans = (config: BetterAuthConfig) => [
    { name: 'starter', priceId: config.stripeStarterPriceId },
    { name: 'pro', priceId: config.stripeProPriceId },
];

export const stripePlugin = (stripeClient: StripeESM, config: BetterAuthConfig, pool: Pool, httpClient: HttpClientService) => {
    const stripeUtils = new StripeUtils(config, httpClient);

    return stripe({
        stripeClient,
        stripeWebhookSecret: config.stripeWebhookSecret,
        createCustomerOnSignUp: true,
        organization: { enabled: true },
        subscription: {
            enabled: true,
            plans: stripePlans(config),
            authorizeReference: authorizeOrganizationBillingReference(pool),
            onSubscriptionUpdate: ({ subscription }) => stripeUtils.onSubscriptionUpdate(subscription),
            onSubscriptionCancel: ({ subscription }) => stripeUtils.onSubscriptionCancel(subscription),
            onSubscriptionDeleted: ({ subscription }) => stripeUtils.onSubscriptionDeleted(subscription),
        },
    });
};
