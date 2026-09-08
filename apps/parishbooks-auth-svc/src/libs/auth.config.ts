import { Logger } from '@nestjs/common';
import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { bearer, emailOTP, organization } from 'better-auth/plugins';
import { HttpClientService, INTERNAL_SERVICE_KEY_HEADER } from '@parishbooks/core';
import Stripe from 'stripe';
import { Pool } from 'pg';
import { BetterAuthConfig } from '../types/auth.types';
import { buildConnectionPool } from '../utils/auth.utils';

const logger = new Logger('EmailOTP');
const billingLogger = new Logger('StripeBilling');

interface StripeSubscriptionSummary {
    plan: string;
    status: string;
}

/**
 * Maps a BetterAuth stripe-plugin subscription state to the fields org-svc's
 * billing-sync endpoint expects. `planTier` is only included on an active
 * subscription — a status-only change (past_due/canceled) must not stomp the
 * org's last-known plan tier.
 */
export const mapStripeSubscriptionToBillingSync = (subscription: StripeSubscriptionSummary): { planTier?: string; billingStatus: string } => {
    const statusMap: Record<string, string> = { active: 'active', trialing: 'active', past_due: 'pastDue', canceled: 'canceled', unpaid: 'pastDue' };
    const billingStatus = statusMap[subscription.status] ?? 'pastDue';
    return billingStatus === 'active' ? { planTier: subscription.plan, billingStatus } : { billingStatus };
};

const authorizeOrganizationBillingReference = (pool: Pool) => {
    return async ({ user, referenceId }: { user: { id: string }; referenceId: string }): Promise<boolean> => {
        const result = await pool.query<{ role: string }>('SELECT role FROM auth.member WHERE organization_id = $1 AND user_id = $2', [
            referenceId,
            user.id,
        ]);
        const role = result.rows[0]?.role;
        return role === 'owner' || role === 'admin';
    };
};

const syncOrgBilling = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    return async (referenceId: string, subscription: StripeSubscriptionSummary): Promise<void> => {
        try {
            await httpClient.patch(`${config.orgServiceUrl}/organizations/${referenceId}/billing-sync`, mapStripeSubscriptionToBillingSync(subscription), {
                headers: { [INTERNAL_SERVICE_KEY_HEADER]: config.internalServiceKey },
            });
        } catch (error) {
            billingLogger.error(`Failed to sync billing for organization ${referenceId}: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        }
    };
};

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
                    onSubscriptionCancel: async ({ subscription }) => {
                        await syncBilling(subscription.referenceId, { plan: subscription.plan, status: 'canceled' });
                    },
                },
                organization: { enabled: true },
            }),
        ],
    });
};
