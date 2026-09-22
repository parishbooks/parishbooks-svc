import { getMetadataArgsStorage } from 'typeorm';
import { OrganizationOnboardingSubmission } from '../organization-onboarding-submission.entity';

describe('OrganizationOnboardingSubmission', () => {
    it('is registered under the organization_onboarding_submission table', () => {
        const table = getMetadataArgsStorage().tables.find((t) => t.target === OrganizationOnboardingSubmission);
        expect(table?.name).toBe('organization_onboarding_submission');
    });

    it('declares a composite index on organizationId and id', () => {
        const indices = getMetadataArgsStorage().indices.filter((i) => i.target === OrganizationOnboardingSubmission);
        const hasCompositeIndex = indices.some((i) => Array.isArray(i.columns) && i.columns.includes('organizationId') && i.columns.includes('id'));
        expect(hasCompositeIndex).toBe(true);
    });

    it('does not persist raw PAN or bank account fields', () => {
        const columns = getMetadataArgsStorage()
            .columns.filter((c) => c.target === OrganizationOnboardingSubmission)
            .map((c) => c.propertyName);
        expect(columns).toContain('panNumberMasked');
        expect(columns).toContain('bankAccountMasked');
        expect(columns).not.toContain('panNumber');
        expect(columns).not.toContain('bankAccountNumber');
    });
});
