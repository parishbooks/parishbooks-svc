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
 * org's last-known plan tier. `billingProvider` is always `stripe` — this
 * file only ever handles Stripe subscriptions.
 */
export const mapStripeSubscriptionToBillingSync = (
    subscription: StripeSubscriptionSummary,
): { planTier?: string; billingStatus: string; billingProvider: 'stripe' } => {
    const statusMap: Record<string, string> = { active: 'active', trialing: 'active', past_due: 'pastDue', canceled: 'canceled', unpaid: 'pastDue' };
    const billingStatus = statusMap[subscription.status] ?? 'pastDue';
    return billingStatus === 'active'
        ? { planTier: subscription.plan, billingStatus, billingProvider: 'stripe' }
        : { billingStatus, billingProvider: 'stripe' };
};

/**
 * Authorizes a billing action (e.g. starting a checkout, opening the billing
 * portal) against BetterAuth's organization-plugin `member` table. The
 * plugin's Postgres schema declares fields as camelCase (`organizationId`,
 * `userId`) and, absent a snake_case naming strategy in `betterAuthConfig`
 * (there isn't one here), creates matching camelCase columns — so the
 * identifiers must be double-quoted or Postgres folds them to lowercase and
 * the query silently returns zero rows.
 */
export const authorizeOrganizationBillingReference = (pool: Pool) => {
    return async ({ user, referenceId }: { user: { id: string }; referenceId: string }): Promise<boolean> => {
        const result = await pool.query<{ role: string }>('SELECT role FROM auth.member WHERE "organizationId" = $1 AND "userId" = $2', [
            referenceId,
            user.id,
        ]);
        const role = result.rows[0]?.role;
        return role === 'owner' || role === 'admin';
    };
};

const SYNC_RETRY_DELAYS_MS = [200, 500];

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pushes a subscription state change to org-svc's billing-sync endpoint.
 *
 * BetterAuth's stripe() plugin wraps every subscription hook call in its own
 * try/catch and always responds 200 to Stripe regardless of what the hook
 * does — so throwing here does NOT make Stripe retry the webhook. Instead we
 * retry locally a few times, then give up and log loudly so a persistent
 * failure is visible in logs/alerting even though Stripe never learns about
 * it.
 */
const syncOrgBilling = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    return async (referenceId: string, subscription: StripeSubscriptionSummary): Promise<void> => {
        const payload = mapStripeSubscriptionToBillingSync(subscription);
        const attempts = SYNC_RETRY_DELAYS_MS.length + 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                await httpClient.patch(`${config.orgServiceUrl}/organizations/${referenceId}/billing-sync`, payload, {
                    headers: { [INTERNAL_SERVICE_KEY_HEADER]: config.internalServiceKey },
                });
                return;
            } catch (error) {
                const isLastAttempt = attempt === attempts;
                if (isLastAttempt) {
                    billingLogger.error(
                        `Failed to sync billing for organization ${referenceId} after ${attempts} attempts. payload=${JSON.stringify(payload)} error=${(error as Error).message}`,
                        (error as Error).stack,
                    );
                    return;
                }
                billingLogger.warn(
                    `Billing sync attempt ${attempt}/${attempts} failed for organization ${referenceId}: ${(error as Error).message}. Retrying...`,
                );
                await delay(SYNC_RETRY_DELAYS_MS[attempt - 1]);
            }
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
