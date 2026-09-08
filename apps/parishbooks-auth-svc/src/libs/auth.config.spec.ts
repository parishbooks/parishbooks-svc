import { Pool } from 'pg';
import { authorizeOrganizationBillingReference, mapStripeSubscriptionToBillingSync } from './auth.config';

describe('mapStripeSubscriptionToBillingSync', () => {
    it('maps an active subscription to billingStatus active and the matching planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'active' })).toEqual({
            planTier: 'pro',
            billingStatus: 'active',
            billingProvider: 'stripe',
        });
    });

    it('maps a trialing subscription to billingStatus active and the matching planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'trialing' })).toEqual({
            planTier: 'pro',
            billingStatus: 'active',
            billingProvider: 'stripe',
        });
    });

    it('maps a past_due subscription to billingStatus pastDue without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'past_due' })).toEqual({
            billingStatus: 'pastDue',
            billingProvider: 'stripe',
        });
    });

    it('maps a canceled subscription to billingStatus canceled without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'canceled' })).toEqual({
            billingStatus: 'canceled',
            billingProvider: 'stripe',
        });
    });
});

describe('authorizeOrganizationBillingReference', () => {
    const buildPool = (rows: Array<{ role: string }>) => ({ query: jest.fn().mockResolvedValue({ rows }) }) as unknown as Pool;

    it('authorizes an owner', async () => {
        const pool = buildPool([{ role: 'owner' }]);
        const authorize = authorizeOrganizationBillingReference(pool);
        await expect(authorize({ user: { id: 'user-1' }, referenceId: 'org-1' })).resolves.toBe(true);
        expect(pool.query).toHaveBeenCalledWith('SELECT role FROM auth.member WHERE "organizationId" = $1 AND "userId" = $2', ['org-1', 'user-1']);
    });

    it('authorizes an admin', async () => {
        const pool = buildPool([{ role: 'admin' }]);
        const authorize = authorizeOrganizationBillingReference(pool);
        await expect(authorize({ user: { id: 'user-1' }, referenceId: 'org-1' })).resolves.toBe(true);
    });

    it('rejects a plain member', async () => {
        const pool = buildPool([{ role: 'member' }]);
        const authorize = authorizeOrganizationBillingReference(pool);
        await expect(authorize({ user: { id: 'user-1' }, referenceId: 'org-1' })).resolves.toBe(false);
    });

    it('rejects when there is no matching row', async () => {
        const pool = buildPool([]);
        const authorize = authorizeOrganizationBillingReference(pool);
        await expect(authorize({ user: { id: 'user-1' }, referenceId: 'org-1' })).resolves.toBe(false);
    });
});
