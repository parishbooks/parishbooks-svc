import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationProfile } from '@parishbooks/database';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class OrganizationProfileRepository extends BaseRepository<OrganizationProfile> {
    constructor(dataSource: DataSource) {
        super(OrganizationProfile, dataSource);
    }

    findByOrganizationId(organizationId: string): Promise<OrganizationProfile | null> {
        return this.findOneBy({ organizationId });
    }

    findByCashfreeVendorId(cashfreeVendorId: string): Promise<OrganizationProfile | null> {
        return this.findOneBy({ cashfreeVendorId });
    }

    createProfile(data: Partial<OrganizationProfile>): Promise<OrganizationProfile> {
        return this.save(this.create(data));
    }

    // Accepts an optional transactional EntityManager so a caller (e.g.
    // OrganizationOnboardingService.submit) can run this write in the same
    // DB transaction as another entity's write — CLAUDE.md's rule that any
    // write touching more than one entity runs inside a single queryRunner
    // transaction. Defaults to this repository's own manager so existing
    // non-transactional callers are unaffected.
    updateProfile(id: string, data: Partial<OrganizationProfile>, manager: EntityManager = this.manager): Promise<OrganizationProfile> {
        const repository = manager.getRepository(OrganizationProfile);
        return repository.save(repository.create({ id, ...data }));
    }
}
