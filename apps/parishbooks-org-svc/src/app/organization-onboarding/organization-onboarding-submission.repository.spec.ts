import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';

describe('OrganizationOnboardingSubmissionRepository', () => {
    it('creates and saves a submission via the base repository', async () => {
        const repository = Object.create(OrganizationOnboardingSubmissionRepository.prototype) as OrganizationOnboardingSubmissionRepository;
        const created = { organizationId: 'org-1', businessName: 'Church' };
        const saved = { id: 'sub-1', ...created };
        const create = jest.fn().mockReturnValue(created);
        const save = jest.fn().mockResolvedValue(saved);
        Object.assign(repository, { create, save });

        const result = await repository.createSubmission({ organizationId: 'org-1', businessName: 'Church' });

        expect(create).toHaveBeenCalledWith({ organizationId: 'org-1', businessName: 'Church' });
        expect(save).toHaveBeenCalledWith(created);
        expect(result).toEqual(saved);
    });
});
