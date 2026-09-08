import { Logger } from '@nestjs/common';
import { HttpClientService, INTERNAL_SERVICE_KEY_HEADER } from '@parishbooks/core';
import { Pool } from 'pg';
import { BetterAuthConfig } from '../types/auth.types';

const billingLogger = new Logger('StripeBilling');

export const buildConnectionPool = (databaseURL: string) => {
    const options = `options=-c search_path=auth`;
    return new Pool({ connectionString: `${databaseURL}?${options}` });
};

export interface StripeSubscriptionSummary {
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
        const query = 'SELECT role FROM auth.member WHERE "organizationId" = $1 AND "userId" = $2';
        const result = await pool.query<{ role: string }>(query, [referenceId, user.id]);
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
export const syncOrgBilling = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    return async (referenceId: string, subscription: StripeSubscriptionSummary): Promise<void> => {
        const payload = mapStripeSubscriptionToBillingSync(subscription);
        const attempts = SYNC_RETRY_DELAYS_MS.length + 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const endpoint = `${config.orgServiceUrl}/organizations/${referenceId}/billing-sync`;
                await httpClient.patch(endpoint, payload, { headers: { [INTERNAL_SERVICE_KEY_HEADER]: config.internalServiceKey } });
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
