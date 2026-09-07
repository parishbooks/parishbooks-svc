import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationProfile } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class OrganizationProfileRepository extends BaseRepository<OrganizationProfile> {
    constructor(dataSource: DataSource) {
        super(OrganizationProfile, dataSource);
    }

    findByOrganizationId(organizationId: string): Promise<OrganizationProfile | null> {
        return this.findOneBy({ organizationId });
    }

    createProfile(data: Partial<OrganizationProfile>): Promise<OrganizationProfile> {
        return this.save(this.create(data));
    }
}
