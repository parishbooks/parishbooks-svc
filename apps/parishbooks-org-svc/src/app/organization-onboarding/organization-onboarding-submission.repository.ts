import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationOnboardingSubmission } from '@parishbooks/database';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class OrganizationOnboardingSubmissionRepository extends BaseRepository<OrganizationOnboardingSubmission> {
    constructor(dataSource: DataSource) {
        super(OrganizationOnboardingSubmission, dataSource);
    }

    // See OrganizationProfileRepository.updateProfile's comment on the
    // optional `manager` parameter — this write and the OrganizationProfile
    // update in OrganizationOnboardingService.submit() must commit or roll
    // back together.
    createSubmission(data: Partial<OrganizationOnboardingSubmission>, manager: EntityManager = this.manager): Promise<OrganizationOnboardingSubmission> {
        const repository = manager.getRepository(OrganizationOnboardingSubmission);
        return repository.save(repository.create(data));
    }
}
