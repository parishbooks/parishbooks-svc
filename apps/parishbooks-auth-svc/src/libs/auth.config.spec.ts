import { mapStripeSubscriptionToBillingSync } from './auth.config';

describe('mapStripeSubscriptionToBillingSync', () => {
    it('maps an active subscription to billingStatus active and the matching planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'active' })).toEqual({
            planTier: 'pro',
            billingStatus: 'active',
        });
    });

    it('maps a past_due subscription to billingStatus pastDue without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'past_due' })).toEqual({
            billingStatus: 'pastDue',
        });
    });

    it('maps a canceled subscription to billingStatus canceled without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'canceled' })).toEqual({
            billingStatus: 'canceled',
        });
    });
});
