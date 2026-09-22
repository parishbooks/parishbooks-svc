import { OrganizationBillingStatus, OrganizationProfile } from '../organization-profile.entity';

describe('OrganizationProfile', () => {
    it('defaults billingStatus to active on a new instance', () => {
        const profile = new OrganizationProfile();
        Object.assign(profile, { billingStatus: OrganizationBillingStatus.ACTIVE });
        expect(profile.billingStatus).toBe('active');
    });
});
