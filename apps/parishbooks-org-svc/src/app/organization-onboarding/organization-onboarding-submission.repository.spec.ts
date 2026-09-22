import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';

describe('OrganizationOnboardingSubmissionRepository', () => {
    it('creates and saves a submission via its own manager by default', async () => {
        const repository = Object.create(OrganizationOnboardingSubmissionRepository.prototype) as OrganizationOnboardingSubmissionRepository;
        const created = { organizationId: 'org-1', businessName: 'Church' };
        const saved = { id: 'sub-1', ...created };
        const create = jest.fn().mockReturnValue(created);
        const save = jest.fn().mockResolvedValue(saved);
        const innerRepository = { create, save };
        const getRepository = jest.fn().mockReturnValue(innerRepository);
        Object.assign(repository, { manager: { getRepository } });

        const result = await repository.createSubmission({ organizationId: 'org-1', businessName: 'Church' });

        expect(create).toHaveBeenCalledWith({ organizationId: 'org-1', businessName: 'Church' });
        expect(save).toHaveBeenCalledWith(created);
        expect(result).toEqual(saved);
    });

    it('creates and saves a submission via an explicitly passed transactional manager', async () => {
        const repository = Object.create(OrganizationOnboardingSubmissionRepository.prototype) as OrganizationOnboardingSubmissionRepository;
        const created = { organizationId: 'org-1', businessName: 'Church' };
        const saved = { id: 'sub-1', ...created };
        const create = jest.fn().mockReturnValue(created);
        const save = jest.fn().mockResolvedValue(saved);
        const txManagerRepository = { create, save };
        const txGetRepository = jest.fn().mockReturnValue(txManagerRepository);
        const txManager = { getRepository: txGetRepository } as never;
        const ownGetRepository = jest.fn();
        Object.assign(repository, { manager: { getRepository: ownGetRepository } });

        const result = await repository.createSubmission({ organizationId: 'org-1', businessName: 'Church' }, txManager);

        expect(ownGetRepository).not.toHaveBeenCalled();
        expect(txGetRepository).toHaveBeenCalled();
        expect(result).toEqual(saved);
    });
});
