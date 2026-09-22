import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationOnboardingSubmission } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class OrganizationOnboardingSubmissionRepository extends BaseRepository<OrganizationOnboardingSubmission> {
    constructor(dataSource: DataSource) {
        super(OrganizationOnboardingSubmission, dataSource);
    }

    createSubmission(data: Partial<OrganizationOnboardingSubmission>): Promise<OrganizationOnboardingSubmission> {
        return this.save(this.create(data));
    }
}
